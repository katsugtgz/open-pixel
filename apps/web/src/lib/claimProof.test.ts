import { describe, expect, it } from "vitest";
import { createDemoQuestRun, SUPABASE_TABLES } from "@open-pixel/shared";
import {
  connectWallet,
  saveGuestClaim,
  signQuestProof,
  type WalletAdapter,
} from "./claimProof";

const questRun = createDemoQuestRun({
  guestId: "guest_test123",
  displayName: "Tester",
});

// Fake SupabaseAdapter: from().upsert() resolves { error } per table.
function fakeSupabase(errors: Record<string, unknown> = {}) {
  return {
    from: (table: string) => ({
      upsert: () => Promise.resolve({ error: errors[table] ?? null }),
    }),
  };
}

function fakeWallet(
  handler: (args: { method: string; params?: unknown[] }) => Promise<unknown>,
): WalletAdapter {
  return { request: handler };
}

describe("saveGuestClaim", () => {
  it("returns local-ready status when supabase is null", async () => {
    const result = await saveGuestClaim({ supabase: null, questRun });
    expect(result.ok).toBe(true);
    expect(result.status).toContain("locally");
  });

  it("fails with a formatted status when the player upsert errors", async () => {
    const result = await saveGuestClaim({
      supabase: fakeSupabase({
        [SUPABASE_TABLES.players]: { message: "boom" },
      }),
      questRun,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toContain("player save failed");
    expect(result.status).toContain("boom");
  });

  it("fails when the quest upsert errors", async () => {
    const result = await saveGuestClaim({
      supabase: fakeSupabase({
        [SUPABASE_TABLES.questRuns]: { message: "quest-boom" },
      }),
      questRun,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toContain("quest save failed");
  });

  it("reports synced on success", async () => {
    const result = await saveGuestClaim({ supabase: fakeSupabase(), questRun });
    expect(result.ok).toBe(true);
    expect(result.status).toContain("synced");
  });
});

describe("connectWallet", () => {
  it("fails when no wallet is present", async () => {
    const result = await connectWallet(undefined);
    expect(result.ok).toBe(false);
  });

  it("returns the first account on success", async () => {
    const result = await connectWallet(fakeWallet(async () => ["0xabc"]));
    expect(result.ok).toBe(true);
    expect(result.walletAddress).toBe("0xabc");
  });

  it("reports a rejected status when the wallet throws 4001", async () => {
    const result = await connectWallet(
      fakeWallet(async () => {
        throw { code: 4001 };
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.status).toMatch(/rejected/i);
  });
});

describe("signQuestProof", () => {
  it("fails without a wallet address", async () => {
    const result = await signQuestProof({
      wallet: undefined,
      supabase: null,
      questRun,
      walletAddress: "",
      domain: "example.test",
    });
    expect(result.ok).toBe(false);
  });

  it("signs locally when supabase is null", async () => {
    const result = await signQuestProof({
      wallet: fakeWallet(async () => "0xsig"),
      supabase: null,
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
    });
    expect(result.ok).toBe(true);
    expect(result.signature).toBe("0xsig");
  });

  it("keeps the signature even when the proof save fails", async () => {
    const result = await signQuestProof({
      wallet: fakeWallet(async () => "0xsig"),
      supabase: fakeSupabase({
        [SUPABASE_TABLES.walletProofs]: { message: "proof-boom" },
      }),
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
    });
    expect(result.ok).toBe(false);
    expect(result.signature).toBe("0xsig");
    expect(result.status).toContain("proof save failed");
  });

  it("fails when the wallet signing throws", async () => {
    const result = await signQuestProof({
      wallet: fakeWallet(async () => {
        throw { code: 4001 };
      }),
      supabase: null,
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
    });
    expect(result.ok).toBe(false);
  });
});
