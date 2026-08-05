// Supabase Edge Function: verify-wallet-proof
//
// Verifies a `personal_sign` wallet proof for a quest run, then inserts the
// verified row into `public.wallet_proofs`. Returns 200 on success, 401 on
// any verification failure (bad signature, address mismatch, expired
// message, malformed body, or DB insert error).
//
// Body: { quest_run_id, wallet_address, message, signature }

import { recoverMessageAddress } from "npm:viem@2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const JSON_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  ...CORS_HEADERS,
};

type VerifyRequestBody = {
  quest_run_id?: unknown;
  wallet_address?: unknown;
  message?: unknown;
  signature?: unknown;
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

// Extracts the value of a `Label: <value>` line from a canonical proof
// message (see buildProofMessage in packages/shared/src/index.ts). Returns
// null when the line is absent.
function parseProofLine(message: string, label: string): string | null {
  const match = message.match(new RegExp(`^${label}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

// Upper bound on how far in the future a proof may expire. The client sets a
// 10-minute TTL (createProofMessage default); 1 hour is generous and stops a
// stolen proof from being replayed indefinitely.
const MAX_PROOF_TTL_MS = 60 * 60 * 1000;

function unauthorized(reason: string): Response {
  return json({ verified: false, error: reason }, 401);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS, status: 200 });
  }

  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return unauthorized("malformed json body");
  }

  const {
    quest_run_id: questRunId,
    wallet_address: walletAddress,
    message,
    signature,
  } = body;

  if (
    !isString(questRunId) ||
    !isString(walletAddress) ||
    !isString(message) ||
    !isString(signature)
  ) {
    return unauthorized("missing or non-string field");
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return unauthorized("wallet_address is not a valid EIP-55 address");
  }

  if (!/^0x[a-fA-F0-9]+$/.test(signature)) {
    return unauthorized("signature is not a hex string");
  }

  let recovered: `0x${string}`;
  try {
    recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return unauthorized("signature recovery failed");
  }

  if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
    return unauthorized("recovered address does not match wallet_address");
  }

  // Bind the signed message to the request before persisting. A valid
  // signature over arbitrary text would otherwise be replayable against any
  // quest_run_id. The canonical message format is produced by
  // buildProofMessage (packages/shared/src/index.ts) and carries Domain,
  // Wallet, Quest Run, and Expiration Time lines that we pin to this call.
  const firstLine = message.split("\n", 1)[0];
  if (firstLine !== "Open Pixel Proof") {
    return unauthorized("message is not a canonical Open Pixel proof");
  }

  const expirationRaw = parseProofLine(message, "Expiration Time");
  if (!expirationRaw) {
    return unauthorized("proof message missing Expiration Time");
  }
  const expiration = new Date(expirationRaw);
  if (Number.isNaN(expiration.getTime())) {
    return unauthorized("proof Expiration Time is not a valid date");
  }
  if (expiration.getTime() < Date.now()) {
    return unauthorized("proof expired");
  }
  if (expiration.getTime() > Date.now() + MAX_PROOF_TTL_MS) {
    return unauthorized("proof expiration too far in the future");
  }

  const signedQuestRun = parseProofLine(message, "Quest Run");
  if (!signedQuestRun || signedQuestRun !== questRunId) {
    return unauthorized("signed Quest Run does not match quest_run_id");
  }

  const signedWallet = parseProofLine(message, "Wallet");
  if (
    !signedWallet ||
    signedWallet.toLowerCase() !== walletAddress.toLowerCase()
  ) {
    return unauthorized("signed Wallet does not match wallet_address");
  }

  const signedDomain = parseProofLine(message, "Domain");
  if (!signedDomain) {
    return unauthorized("proof message missing Domain");
  }
  // The signed Domain is caller-controlled and the Origin header is
  // forgeable by non-browser callers (CORS is `*`), so an Origin
  // comparison alone only enforces internal consistency. ALLOWED_DOMAINS
  // (comma-separated canonical app hosts) is the authoritative server-
  // side trust boundary when configured; without it we fall back to the
  // Origin check so existing deployments keep working.
  const allowedDomainsRaw = Deno.env.get("ALLOWED_DOMAINS");
  if (allowedDomainsRaw) {
    const allowed = new Set(
      allowedDomainsRaw
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    );
    if (!allowed.has(signedDomain)) {
      return unauthorized("signed Domain is not an allowed app host");
    }
  } else {
    const origin = req.headers.get("origin");
    if (!origin) {
      return unauthorized("missing Origin header");
    }
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return unauthorized("invalid Origin header");
    }
    if (originHost !== signedDomain) {
      return unauthorized("signed Domain does not match request origin");
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ verified: false, error: "server misconfigured" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from("wallet_proofs").insert({
    quest_run_id: questRunId,
    wallet_address: walletAddress,
    message,
    signature,
    method: "personal_sign",
  });

  if (error) {
    console.error("wallet_proofs insert failed", error);
    return unauthorized("proof insert failed");
  }

  return json({ verified: true, wallet_address: walletAddress }, 200);
});
