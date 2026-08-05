import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProofMessage,
  createDemoQuestRun,
  createProofMessage,
  createGuestId,
  DEFAULT_QUEST_ID,
  formatSupabaseError,
  isSupabaseMissingTableError,
  SECURITY_RECEIPT,
  SUPABASE_COLUMNS,
  SUPABASE_SCHEMA_TARGETS,
  SUPABASE_SCHEMA_MISSING_TEXT,
  SUPABASE_TABLES,
  toLeaderboardEntry,
  toPlayerRow,
  toQuestRunRow,
  toWalletProofRow,
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

describe("claim/proof row shaping", () => {
  const questRun = createDemoQuestRun({
    guestId: "guest_12345678",
    displayName: "  Pixel Farmer  ",
    completedAt: "2026-06-18T00:00:00.000Z",
  });

  it("creates the canonical demo quest run", () => {
    assert.match(
      questRun.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    assert.notEqual(questRun.id, "run_guest_12345678");
    assert.equal(questRun.displayName, "Pixel Farmer");
    assert.equal(questRun.questId, DEFAULT_QUEST_ID);
    assert.equal(questRun.points, 130);
    assert.equal(questRun.shards, 3);
  });

  it("generates a fresh non-deterministic id per call", () => {
    const a = createDemoQuestRun({
      guestId: "guest_12345678",
      displayName: "Pixel Farmer",
    });
    const b = createDemoQuestRun({
      guestId: "guest_12345678",
      displayName: "Pixel Farmer",
    });
    assert.notEqual(a.id, b.id);
  });

  it("maps claim rows to the expected Supabase tables", () => {
    assert.equal(SUPABASE_TABLES.players, "players");
    assert.equal(SUPABASE_TABLES.questRuns, "quest_runs");
    assert.deepEqual(
      SUPABASE_SCHEMA_TARGETS.map((target) => [target.name, target.columns]),
      [
        [SUPABASE_TABLES.players, SUPABASE_COLUMNS.players],
        [SUPABASE_TABLES.questRuns, SUPABASE_COLUMNS.questRuns],
        [SUPABASE_TABLES.walletProofs, SUPABASE_COLUMNS.walletProofs],
        [SUPABASE_TABLES.leaderboard, SUPABASE_COLUMNS.leaderboard],
      ],
    );
    assert.deepEqual(SUPABASE_COLUMNS.players, [
      "guest_id",
      "wallet_address",
      "display_name",
    ]);

    assert.deepEqual(toPlayerRow({ questRun, walletAddress: "" }), {
      guest_id: "guest_12345678",
      wallet_address: null,
      display_name: "Pixel Farmer",
    });
    assert.deepEqual(toQuestRunRow(questRun), {
      id: questRun.id,
      guest_id: "guest_12345678",
      display_name: "Pixel Farmer",
      quest_id: "Quest #1 - Restore village nodes",
      points: 130,
      shards: 3,
      completed_at: "2026-06-18T00:00:00.000Z",
    });
  });

  it("truncates display_name to the schema's 32-char limit", () => {
    const longName = "A".repeat(64);
    const longRun = createDemoQuestRun({
      guestId: "guest_long",
      displayName: longName,
    });
    const row = toPlayerRow({ questRun: longRun });
    assert.equal(row.display_name.length, 32);
    assert.equal(row.display_name, longName.slice(0, 32));
  });

  it("creates readable personal_sign proof rows", () => {
    const proof = createProofMessage({
      domain: "open-pixel.test",
      walletAddress: "0x1234",
      questRun,
      nonce: "nonce-test",
      issuedAt: "2026-06-18T00:00:00.000Z",
      ttlMs: 600_000,
    });

    assert.match(proof.message, /Open Pixel Proof/);
    assert.match(proof.message, /does not approve tokens/i);
    assert.equal(proof.issuedAt, "2026-06-18T00:00:00.000Z");
    assert.equal(proof.nonce, "nonce-test");
    assert.equal(proof.expirationTime, "2026-06-18T00:10:00.000Z");
    assert.deepEqual(
      toWalletProofRow({
        questRun,
        walletAddress: "0x1234",
        message: proof.message,
        signature: "0xabcd",
        verifiedAt: "2026-06-18T00:01:00.000Z",
      }),
      {
        quest_run_id: questRun.id,
        wallet_address: "0x1234",
        message: proof.message,
        signature: "0xabcd",
        method: "personal_sign",
        verified_at: "2026-06-18T00:01:00.000Z",
      },
    );
  });

  it("rejects invalid issuedAt instead of producing a RangeError", () => {
    assert.throws(
      () =>
        createProofMessage({
          domain: "open-pixel.test",
          walletAddress: "0x1234",
          questRun,
          issuedAt: "not-a-date",
        }),
      /invalid issuedAt/,
    );
  });

  it("defaults proof expiry to ten minutes with a generated nonce", () => {
    const proof = createProofMessage({
      domain: "open-pixel.test",
      walletAddress: "0x1234",
      questRun,
    });

    assert.equal(
      new Date(proof.expirationTime).getTime() -
        new Date(proof.issuedAt).getTime(),
      600_000,
    );
    assert.equal(typeof proof.nonce, "string");
    assert.ok(proof.nonce.length > 0);
  });
});

describe("leaderboard row mapping", () => {
  it("maps Supabase leaderboard rows and proof tags", () => {
    assert.deepEqual(
      toLeaderboardEntry({
        display_name: "Shard Scout",
        total_points: "90",
        has_proof: true,
        guest_id: "guest_1",
      }),
      { name: "Shard Scout", score: 90, tag: "proof ready" },
    );
  });

  it("falls back to guest labels for empty names", () => {
    assert.deepEqual(
      toLeaderboardEntry({
        display_name: "",
        points: null,
        has_proof: false,
        guest_id: "guest_2",
      }),
      { name: "guest_2", score: 0, tag: "guest" },
    );
  });

  it("coerces non-finite scores (NaN/Infinity/string-junk) to 0", () => {
    assert.equal(toLeaderboardEntry({ total_points: "not-a-number" }).score, 0);
    assert.equal(
      toLeaderboardEntry({ total_points: Number.POSITIVE_INFINITY }).score,
      0,
    );
    assert.equal(toLeaderboardEntry({ total_points: NaN }).score, 0);
  });
});

describe("wallet proof row wallet-address invariant", () => {
  const questRun = createDemoQuestRun({
    guestId: "guest_invariant",
    displayName: "Invariant Tester",
    completedAt: "2026-06-18T00:00:00.000Z",
  });

  it("throws when the Wallet: line in the message diverges from walletAddress", () => {
    const proof = createProofMessage({
      domain: "open-pixel.test",
      walletAddress: "0x" + "ab".repeat(20),
      questRun,
    });
    assert.throws(
      () =>
        toWalletProofRow({
          questRun,
          walletAddress: "0x" + "cd".repeat(20),
          message: proof.message,
          signature: "0xdeadbeef",
        }),
      /diverges/,
    );
  });

  it("passes through when the Wallet: line matches walletAddress (case-insensitive)", () => {
    const addr = "0x" + "Ab".repeat(20);
    const proof = createProofMessage({
      domain: "open-pixel.test",
      walletAddress: addr,
      questRun,
    });
    const row = toWalletProofRow({
      questRun,
      walletAddress: addr.toLowerCase(),
      message: proof.message,
      signature: "0xdeadbeef",
    });
    assert.equal(row.wallet_address, addr.toLowerCase());
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
