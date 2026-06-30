import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildProofMessage,
  createGuestId,
  createRandomId,
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

describe("random id generation", () => {
  it("returns a non-empty string", () => {
    const id = createRandomId();
    assert.ok(typeof id === "string" && id.length > 0);
  });

  it("produces unique values across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => createRandomId()));
    assert.equal(ids.size, 50);
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

  it("includes domain, wallet, quest run, nonce, and timestamps in the message", () => {
    const message = buildProofMessage({
      domain: "open-pixel-livid.vercel.app",
      walletAddress: "0xAbCd1234",
      questRunId: "run_xyz789",
      questId: "Quest #1",
      points: 100,
      nonce: "nonce-abc-123",
      issuedAt: "2026-06-18T00:00:00.000Z",
      expirationTime: "2026-06-18T00:10:00.000Z",
    });

    assert.match(message, /open-pixel-livid\.vercel\.app/);
    assert.match(message, /0xAbCd1234/);
    assert.match(message, /run_xyz789/);
    assert.match(message, /nonce-abc-123/);
    assert.match(message, /2026-06-18T00:00:00\.000Z/);
    assert.match(message, /2026-06-18T00:10:00\.000Z/);
    assert.match(message, /Quest #1/);
    assert.match(message, /100 off-chain points/);
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

  it("passes through unknown errors without the schema hint", () => {
    const result = formatSupabaseError("Save failed", {
      message: "row-level security policy",
    });
    assert.ok(!result.includes(SUPABASE_SCHEMA_MISSING_TEXT));
    assert.match(result, /row-level security policy/);
  });

  it("handles null or undefined error values gracefully", () => {
    assert.match(formatSupabaseError("Failed", null), /Unknown Supabase error/);
    assert.match(
      formatSupabaseError("Failed", undefined),
      /Unknown Supabase error/,
    );
  });
});
