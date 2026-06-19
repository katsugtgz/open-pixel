import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProofMessage,
  buildStoredQuestRun,
  createGuestId,
  formatSupabaseError,
  isSupabaseMissingTableError,
  normalizeLeaderboardRows,
  parseStoredQuestRun,
  SECURITY_RECEIPT,
  serializeQuestRunForStorage,
  SUPABASE_SCHEMA_MISSING_TEXT,
} from "../dist/index.js";

describe("guest id generation", () => {
  it("uses the guest UUID format", () => {
    assert.match(
      createGuestId(),
      /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe("wallet proof safety copy", () => {
  it("builds a readable personal proof message that denies approvals/tx", () => {
    const message = buildProofMessage({
      domain: "open-pixel-livid.vercel.app",
      walletAddress: "0x1234",
      questRunId: "run_test",
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      nonce: "nonce-test",
      issuedAt: "2026-06-18T00:00:00.000Z",
      expirationTime: "2026-06-18T00:10:00.000Z",
    });

    assert.match(message, /Open Pixel Proof/);
    assert.match(message, /130 off-chain points/);
    assert.match(
      message,
      /does not approve tokens, NFTs, swaps, transfers, or transactions/i,
    );
  });

  it("keeps the receipt free of transactions, approvals, spender, or contract calls", () => {
    assert.deepEqual(SECURITY_RECEIPT, {
      method: "personal_sign",
      transaction: "none",
      contractCall: "none",
      tokenApproval: "none",
      nftApproval: "none",
      spender: "none",
    });
  });
});

describe("Supabase schema diagnostics", () => {
  it("detects Supabase schema-cache missing-table errors", () => {
    assert.equal(
      isSupabaseMissingTableError({
        code: "PGRST205",
        message:
          "Could not find the table 'public.players' in the schema cache",
      }),
      true,
    );
  });

  it("detects Postgres relation missing errors", () => {
    assert.equal(
      isSupabaseMissingTableError({
        message: 'relation "public.players" does not exist',
      }),
      true,
    );
  });

  it("does not misclassify permissions as missing schema", () => {
    assert.equal(
      isSupabaseMissingTableError({
        code: "42501",
        message: "permission denied for table players",
      }),
      false,
    );
  });

  it("formats missing schema with the exact operator action", () => {
    assert.equal(
      formatSupabaseError("Supabase player save failed", {
        message:
          "Could not find the table 'public.players' in the schema cache",
      }),
      `Supabase player save failed: ${SUPABASE_SCHEMA_MISSING_TEXT}`,
    );
  });
});

describe("leaderboard row normalization", () => {
  it("coerces snake_case Supabase rows to camelCase LeaderboardRow", () => {
    const rows = normalizeLeaderboardRows([
      {
        guest_id: "guest_1",
        display_name: "A",
        total_points: 50,
        completed_runs: 1,
        last_completed_at: "2026-01-01T00:00:00Z",
      },
    ]);
    assert.deepEqual(rows, [
      {
        guestId: "guest_1",
        displayName: "A",
        totalPoints: 50,
        completedRuns: 1,
        lastCompletedAt: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("sorts by totalPoints desc then lastCompletedAt asc", () => {
    const rows = normalizeLeaderboardRows([
      {
        guest_id: "a",
        display_name: "A",
        total_points: 100,
        completed_runs: 1,
        last_completed_at: "2026-01-02T00:00:00Z",
      },
      {
        guest_id: "b",
        display_name: "B",
        total_points: 100,
        completed_runs: 1,
        last_completed_at: "2026-01-01T00:00:00Z",
      },
      {
        guest_id: "c",
        display_name: "C",
        total_points: 130,
        completed_runs: 1,
        last_completed_at: "2026-01-03T00:00:00Z",
      },
    ]);
    assert.deepEqual(
      rows.map((r) => r.guestId),
      ["c", "b", "a"],
    );
  });

  it("caps to default limit 10", () => {
    const input = Array.from({ length: 15 }, (_, i) => ({
      guest_id: `g${i}`,
      display_name: `N${i}`,
      total_points: i,
      completed_runs: 1,
      last_completed_at: "2026-01-01T00:00:00Z",
    }));
    assert.equal(normalizeLeaderboardRows(input).length, 10);
  });

  it("filters junk input without throwing", () => {
    assert.deepEqual(
      normalizeLeaderboardRows([null, {}, "junk", 42, { guest_id: "x" }]),
      [],
    );
  });
});

describe("stored quest run serialization", () => {
  it("builds a StoredQuestRun with defaults", () => {
    const run = buildStoredQuestRun({ guestId: "guest_1", displayName: "A" });
    assert.equal(run.guestId, "guest_1");
    assert.equal(run.points, 0);
    assert.equal(run.shards, 0);
    assert.ok(run.id);
    assert.ok(run.completedAt);
    assert.equal(run.questId, "Quest #1 — Gather Pixel Shards");
  });

  it("round-trips serialize and parse", () => {
    const run = buildStoredQuestRun({
      guestId: "guest_1",
      displayName: "A",
      points: 130,
      shards: 3,
    });
    const parsed = parseStoredQuestRun(serializeQuestRunForStorage(run));
    assert.deepEqual(parsed, run);
  });

  it("parse returns null for junk", () => {
    assert.equal(parseStoredQuestRun("not json"), null);
    assert.equal(parseStoredQuestRun(null), null);
    assert.equal(parseStoredQuestRun(JSON.stringify({ nope: true })), null);
  });

  it("accepts the exact game emit payload shape (regression)", () => {
    // Mirrors apps/game/src/modules/main/event.ts QuestGiver emit on quest done.
    const gameEmitPayload = {
      id: "run_1",
      guestId: "1",
      displayName: "Guest",
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      shards: 3,
      completedAt: "2026-06-20T03:00:00.000Z",
    };
    const parsed = parseStoredQuestRun(JSON.stringify(gameEmitPayload));
    assert.deepEqual(parsed, gameEmitPayload);
  });

  it("rejects payload missing id (regression: handoff must round-trip)", () => {
    const payloadWithoutId = {
      guestId: "1",
      displayName: "Guest",
      questId: "Quest #1 — Gather Pixel Shards",
      points: 130,
      shards: 3,
      completedAt: "2026-06-20T03:00:00.000Z",
    };
    assert.equal(parseStoredQuestRun(JSON.stringify(payloadWithoutId)), null);
  });
});
