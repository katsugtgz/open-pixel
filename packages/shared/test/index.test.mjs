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

describe("random id generation", () => {
  it("produces a non-empty unique string", () => {
    const id = createRandomId();
    assert.ok(typeof id === "string" && id.length > 0);
    assert.notEqual(createRandomId(), createRandomId());
  });
});

describe("guest id generation", () => {
  it("uses the guest UUID format", () => {
    assert.match(
      createGuestId(),
      /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("survives when crypto.randomUUID is missing", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      value: { ...original, randomUUID: undefined },
      configurable: true,
    });
    try {
      const id = createGuestId();
      assert.ok(id.startsWith("guest_"));
      assert.ok(id.length > "guest_".length);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        value: original,
        configurable: true,
      });
    }
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
