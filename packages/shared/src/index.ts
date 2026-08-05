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

export type LeaderboardEntry = {
  name: string;
  score: number;
  tag: string;
};

export type PlayerRow = {
  guest_id: string;
  wallet_address: string | null;
  display_name: string;
};

export type QuestRunRow = {
  id: string;
  guest_id: string;
  display_name: string;
  quest_id: string;
  points: number;
  shards: number;
  completed_at: string;
};

export type WalletProofRow = {
  quest_run_id: string;
  wallet_address: string;
  message: string;
  signature: string;
  method: "personal_sign";
  verified_at: string;
};

export type LeaderboardRow = {
  display_name?: string | null;
  points?: number | string | null;
  total_points?: number | string | null;
  has_proof?: boolean | null;
  guest_id?: string | null;
  completed_runs?: number | string | null;
  last_completed_at?: string | null;
};

export const SUPABASE_TABLES = {
  players: "players",
  questRuns: "quest_runs",
  walletProofs: "wallet_proofs",
  leaderboard: "leaderboard",
} as const;

export const SUPABASE_COLUMNS = {
  players: ["guest_id", "wallet_address", "display_name"],
  questRuns: [
    "id",
    "guest_id",
    "display_name",
    "quest_id",
    "points",
    "shards",
    "completed_at",
  ],
  walletProofs: [
    "quest_run_id",
    "wallet_address",
    "message",
    "signature",
    "method",
    "verified_at",
  ],
  leaderboard: [
    "guest_id",
    "display_name",
    "total_points",
    "completed_runs",
    "last_completed_at",
    "has_proof",
  ],
} as const;

export const SUPABASE_SCHEMA_TARGETS = [
  {
    name: SUPABASE_TABLES.players,
    columns: SUPABASE_COLUMNS.players,
  },
  {
    name: SUPABASE_TABLES.questRuns,
    columns: SUPABASE_COLUMNS.questRuns,
  },
  {
    name: SUPABASE_TABLES.walletProofs,
    columns: SUPABASE_COLUMNS.walletProofs,
  },
  {
    name: SUPABASE_TABLES.leaderboard,
    columns: SUPABASE_COLUMNS.leaderboard,
  },
] as const;

export const DEFAULT_QUEST_ID = "Quest #1 - Restore village nodes";
export const DEFAULT_QUEST_POINTS = 130;
export const DEFAULT_QUEST_SHARDS = 3;

export const DEMO_LEADERBOARD_ROWS: LeaderboardEntry[] = [
  { name: "Pixel Runner", score: 130, tag: "guest" },
  { name: "Shard Scout", score: 90, tag: "proof ready" },
  { name: "Moss Farmer", score: 70, tag: "guest" },
];

export function createRandomId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function createGuestId(): string {
  return `guest_${createRandomId()}`;
}

export function createDemoQuestRun(input: {
  guestId: string;
  displayName: string;
  completedAt?: string;
}): QuestRun {
  return {
    id: createRandomId(),
    guestId: input.guestId,
    displayName: input.displayName.trim() || "Pixel Runner",
    questId: DEFAULT_QUEST_ID,
    points: DEFAULT_QUEST_POINTS,
    shards: DEFAULT_QUEST_SHARDS,
    completedAt: input.completedAt || new Date().toISOString(),
  };
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

export function createProofMessage(input: {
  domain: string;
  walletAddress: string;
  questRun: QuestRun;
  nonce?: string;
  issuedAt?: string;
  ttlMs?: number;
}): {
  message: string;
  issuedAt: string;
  expirationTime: string;
  nonce: string;
} {
  const issuedAtInput = input.issuedAt || new Date().toISOString();
  const issuedAtMs = new Date(issuedAtInput).getTime();
  if (!Number.isFinite(issuedAtMs)) {
    throw new Error(`createProofMessage: invalid issuedAt "${input.issuedAt}"`);
  }
  const issuedAt = new Date(issuedAtMs).toISOString();
  const expirationTime = new Date(
    issuedAtMs + (input.ttlMs || 10 * 60 * 1000),
  ).toISOString();
  const nonce = input.nonce || createRandomId();

  return {
    issuedAt,
    expirationTime,
    nonce,
    message: buildProofMessage({
      domain: input.domain,
      walletAddress: input.walletAddress,
      questRunId: input.questRun.id,
      questId: input.questRun.questId,
      points: input.questRun.points,
      nonce,
      issuedAt,
      expirationTime,
    }),
  };
}

export function toPlayerRow(input: {
  questRun: QuestRun;
  walletAddress?: string;
}): PlayerRow {
  return {
    guest_id: input.questRun.guestId,
    wallet_address: input.walletAddress || null,
    // Mirrors the players.display_name CHECK constraint in supabase/schema.sql.
    display_name: input.questRun.displayName.slice(0, 32),
  };
}

export function toQuestRunRow(questRun: QuestRun): QuestRunRow {
  return {
    id: questRun.id,
    guest_id: questRun.guestId,
    display_name: questRun.displayName,
    quest_id: questRun.questId,
    points: questRun.points,
    shards: questRun.shards,
    completed_at: questRun.completedAt,
  };
}

// SECURITY: the `wallet_address` column and the `Wallet:` line inside the
// signed `message` text MUST reference the same address. The Edge Function
// re-derives the address from the signature, so any mismatch would either
// fail recovery (different address) or persist a row whose column does not
// match what was actually signed. toWalletProofRow() asserts the invariant.
const MESSAGE_WALLET_LINE = /^Wallet:\s*(0x[a-fA-F0-9]{40})\s*$/m;

export function toWalletProofRow(input: {
  questRun: QuestRun;
  walletAddress: string;
  message: string;
  signature: string;
  verifiedAt?: string;
}): WalletProofRow {
  const match = input.message.match(MESSAGE_WALLET_LINE);
  if (match) {
    const messageWallet = match[1];
    if (messageWallet.toLowerCase() !== input.walletAddress.toLowerCase()) {
      throw new Error(
        "toWalletProofRow: wallet_address diverges from the Wallet: line in message",
      );
    }
  }
  return {
    quest_run_id: input.questRun.id,
    wallet_address: input.walletAddress,
    message: input.message,
    signature: input.signature,
    method: "personal_sign",
    verified_at: input.verifiedAt || new Date().toISOString(),
  };
}

export function toLeaderboardEntry(row: LeaderboardRow): LeaderboardEntry {
  const displayName =
    row.display_name?.trim() || row.guest_id || "Guest player";
  const hasProof = Boolean(row.has_proof);
  const rawScore = row.total_points ?? row.points ?? 0;
  const numericScore = Number(rawScore);
  const score = Number.isFinite(numericScore) ? numericScore : 0;

  return {
    name: displayName,
    score,
    tag: hasProof ? "proof ready" : "guest",
  };
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
  "Supabase schema missing. Run supabase/schema.sql in Supabase SQL editor, then retry.";

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

export function isSupabaseMissingTableError(error: unknown): boolean {
  const candidate = error as SupabaseLikeError | null | undefined;
  const message = [candidate?.code, candidate?.message, candidate?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("pgrst205") ||
    (message.includes("schema cache") && message.includes("could not find")) ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function formatSupabaseError(prefix: string, error: unknown): string {
  const candidate = error as SupabaseLikeError | null | undefined;

  if (isSupabaseMissingTableError(error)) {
    return `${prefix}: ${SUPABASE_SCHEMA_MISSING_TEXT}`;
  }

  return `${prefix}: ${candidate?.message || "Unknown Supabase error"}`;
}

export function formatWalletRequestError(error: unknown): string {
  const candidate = error as
    { code?: number; message?: string } | null | undefined;

  if (candidate?.code === 4001) {
    return "Wallet request rejected. Guest mode still works.";
  }

  return candidate?.message || "Wallet request failed. Guest mode still works.";
}
