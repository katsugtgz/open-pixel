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

export function isSupabaseMissingTableError(error: unknown): boolean {
  const candidate = error as SupabaseLikeError | null;
  const message = [candidate?.code, candidate?.message, candidate?.details]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    message.includes("pgrst205") ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

export function formatSupabaseError(prefix: string, error: unknown): string {
  const candidate = error as SupabaseLikeError | null;
  if (isSupabaseMissingTableError(error)) {
    return `${prefix}: ${SUPABASE_SCHEMA_MISSING_TEXT}`;
  }
  return `${prefix}: ${candidate?.message || "Unknown Supabase error"}`;
}

export type LeaderboardRow = {
  guestId: string;
  displayName: string;
  totalPoints: number;
  completedRuns: number;
  lastCompletedAt: string;
};

type LeaderboardInputRow = Record<string, unknown>;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function readStringField(
  row: LeaderboardInputRow,
  key: string,
): string | undefined {
  const value = row[key];
  return isNonEmptyString(value) ? value : undefined;
}

function readNonNegativeIntField(
  row: LeaderboardInputRow,
  key: string,
): number | undefined {
  const value = row[key];
  return isNonNegativeInteger(value) ? value : undefined;
}

export function normalizeLeaderboardRows(
  rows: unknown,
  limit: number = 10,
): LeaderboardRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalized: LeaderboardRow[] = [];

  for (const raw of rows) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      continue;
    }
    const row = raw as LeaderboardInputRow;

    const guestId =
      readStringField(row, "guest_id") ?? readStringField(row, "guestId");
    const displayName =
      readStringField(row, "display_name") ??
      readStringField(row, "displayName");
    const totalPoints =
      readNonNegativeIntField(row, "total_points") ??
      readNonNegativeIntField(row, "totalPoints");
    const completedRuns =
      readNonNegativeIntField(row, "completed_runs") ??
      readNonNegativeIntField(row, "completedRuns");
    const lastCompletedAt =
      readStringField(row, "last_completed_at") ??
      readStringField(row, "lastCompletedAt");

    if (
      guestId === undefined ||
      displayName === undefined ||
      totalPoints === undefined ||
      completedRuns === undefined ||
      lastCompletedAt === undefined
    ) {
      continue;
    }

    normalized.push({
      guestId,
      displayName,
      totalPoints,
      completedRuns,
      lastCompletedAt,
    });
  }

  normalized.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return a.lastCompletedAt < b.lastCompletedAt
      ? -1
      : a.lastCompletedAt > b.lastCompletedAt
        ? 1
        : 0;
  });

  const safeLimit = isNonNegativeInteger(limit) && limit >= 0 ? limit : 0;
  return normalized.slice(0, safeLimit);
}

export type StoredQuestRun = {
  id: string;
  guestId: string;
  displayName: string;
  questId: string;
  points: number;
  shards: number;
  completedAt: string;
};

export function buildStoredQuestRun(input: {
  guestId: string;
  displayName: string;
  questId?: string;
  points?: number;
  shards?: number;
  id?: string;
  completedAt?: string;
}): StoredQuestRun {
  const questId = isNonEmptyString(input.questId)
    ? input.questId
    : "Quest #1 — Gather Pixel Shards";
  const points = isNonNegativeInteger(input.points) ? input.points : 0;
  const shards = isNonNegativeInteger(input.shards) ? input.shards : 0;
  const id = isNonEmptyString(input.id) ? input.id : createRandomId();
  const completedAt = isNonEmptyString(input.completedAt)
    ? input.completedAt
    : new Date().toISOString();

  return {
    id,
    guestId: input.guestId,
    displayName: input.displayName,
    questId,
    points,
    shards,
    completedAt,
  };
}

export function serializeQuestRunForStorage(run: StoredQuestRun): string {
  return JSON.stringify(run);
}

export function parseStoredQuestRun(value: unknown): StoredQuestRun | null {
  if (typeof value !== "string") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const row = parsed as Record<string, unknown>;
  const id = readStringField(row, "id");
  const guestId = readStringField(row, "guestId");
  const displayName = readStringField(row, "displayName");
  const questId = readStringField(row, "questId");
  const completedAt = readStringField(row, "completedAt");
  const points = readNonNegativeIntField(row, "points");
  const shards = readNonNegativeIntField(row, "shards");

  if (
    id === undefined ||
    guestId === undefined ||
    displayName === undefined ||
    questId === undefined ||
    completedAt === undefined ||
    points === undefined ||
    shards === undefined
  ) {
    return null;
  }

  return {
    id,
    guestId,
    displayName,
    questId,
    points,
    shards,
    completedAt,
  };
}
