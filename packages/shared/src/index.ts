export type QuestRun = {
  id: string;
  guestId: string;
  displayName: string;
  questId: string;
  points: number;
  shards: number;
  completedAt: string;
};

export type WalletProof = {
  questRunId: string;
  walletAddress: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  method: "personal_sign";
  verifiedAt: string;
};

export function createRandomId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createGuestId(): string {
  return `guest_${crypto.randomUUID()}`;
}

export function buildProofMessage(input: {
  domain: string;
  walletAddress: string;
  questRunId: string;
  questId: string;
  points: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return [
    "Open Pixel Proof",
    "",
    `I completed ${input.questId} with ${input.points} off-chain points.`,
    "",
    `Domain: ${input.domain}`,
    `Wallet: ${input.walletAddress}`,
    `Quest Run: ${input.questRunId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
    "",
    "This signature only proves quest completion.",
    "It does not approve tokens, NFTs, swaps, transfers, or transactions.",
  ].join("\n");
}

export const SECURITY_RECEIPT = {
  method: "personal_sign",
  transaction: "none",
  contractCall: "none",
  tokenApproval: "none",
  nftApproval: "none",
  spender: "none",
} as const;

export const SUPABASE_SCHEMA_MISSING_TEXT =
  "Supabase schema missing. Run supabase/schema.sql in the Supabase SQL editor, then retry.";

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

function getErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  const candidate = error as SupabaseLikeError | null;
  return candidate?.message || "";
}

export function isSupabaseMissingTableError(error: unknown): boolean {
  if (typeof error === "string") {
    const lower = error.toLowerCase();
    return (
      lower.includes("pgrst205") ||
      lower.includes("schema cache") ||
      lower.includes("could not find the table") ||
      (lower.includes("relation") && lower.includes("does not exist"))
    );
  }

  const candidate = error as SupabaseLikeError | null;
  if (!candidate) return false;

  const combined = [candidate?.code, candidate?.message, candidate?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    combined.includes("pgrst205") ||
    combined.includes("schema cache") ||
    combined.includes("could not find the table") ||
    (combined.includes("relation") && combined.includes("does not exist"))
  );
}

export function formatSupabaseError(prefix: string, error: unknown): string {
  if (isSupabaseMissingTableError(error)) {
    return `${prefix}: ${SUPABASE_SCHEMA_MISSING_TEXT}`;
  }
  const message = getErrorText(error);
  return `${prefix}: ${message || "Unknown Supabase error"}`;
}
