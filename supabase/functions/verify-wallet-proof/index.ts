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

// Parses the `Expiration Time: <iso>` line emitted by buildProofMessage
// (packages/shared/src/index.ts). Returns null when absent or unparseable
// so the caller can decide whether to enforce expiry.
function parseExpirationTime(message: string): Date | null {
  const match = message.match(/^Expiration Time:\s*(.+)$/m);
  if (!match) return null;
  const parsed = new Date(match[1].trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

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

  const expiration = parseExpirationTime(message);
  if (expiration && expiration.getTime() < Date.now()) {
    return unauthorized("proof expired");
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
    return unauthorized(`proof insert failed: ${error.message}`);
  }

  return json({ verified: true, wallet_address: walletAddress }, 200);
});
