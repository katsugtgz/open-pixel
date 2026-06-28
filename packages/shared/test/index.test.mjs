import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProofMessage,
  createGuestId,
  createQuestRun,
  formatSupabaseError,
  isSupabaseMissingTableError,
  SECURITY_RECEIPT,
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

describe("QuestRun resources shape (W1.2 module contract)", () => {
  it("exposes the new resources shape keyed by village-loop item ids", () => {
    const run = createQuestRun({
      id: "run_abc",
      guestId: "guest_abc",
      displayName: "Pixel Runner",
      questId: "Quest #1",
      points: 130,
      resources: {
        popberry: 4,
        whittlewood_log: 3,
        ochrux_matrix: 2,
      },
      completedAt: "2026-06-28T00:00:00.000Z",
    });

    assert.deepEqual(run.resources, {
      popberry: 4,
      whittlewood_log: 3,
      ochrux_matrix: 2,
    });
  });

  it("keeps the legacy shards field populated for Supabase row back-compat", () => {
    const run = createQuestRun({
      id: "run_abc",
      guestId: "guest_abc",
      displayName: "Pixel Runner",
      questId: "Quest #1",
      points: 130,
      resources: { popberry: 0, whittlewood_log: 0, ochrux_matrix: 0 },
      completedAt: "2026-06-28T00:00:00.000Z",
    });

    assert.equal(typeof run.shards, "number");
    assert.equal(run.shards, 0);
  });

  it("preserves off-chain points for the readable personal_sign proof flow", () => {
    const run = createQuestRun({
      id: "run_abc",
      guestId: "guest_abc",
      displayName: "Pixel Runner",
      questId: "Quest #1",
      points: 130,
      resources: { popberry: 4, whittlewood_log: 3, ochrux_matrix: 2 },
      completedAt: "2026-06-28T00:00:00.000Z",
      shards: 3,
    });

    assert.equal(run.points, 130);
    assert.equal(run.shards, 3);
    assert.deepEqual(run.resources, {
      popberry: 4,
      whittlewood_log: 3,
      ochrux_matrix: 2,
    });
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
