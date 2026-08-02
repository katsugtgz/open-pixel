import { describe, expect, it, vi } from "vitest";
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

  it("signs locally when supabaseUrl / publishable key are absent", async () => {
    const result = await signQuestProof({
      wallet: fakeWallet(async () => "0xsig"),
      supabase: fakeSupabase(),
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
    });
    expect(result.ok).toBe(true);
    expect(result.signature).toBe("0xsig");
    expect(result.status).toContain("locally");
  });

  it("keeps the signature even when the Edge Function rejects the proof", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ verified: false, error: "bad sig" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await signQuestProof({
      wallet: fakeWallet(async () => "0xsig"),
      supabase: fakeSupabase(),
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "anon-key",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
    expect(result.signature).toBe("0xsig");
    expect(result.status).toContain("server verification failed");
    expect(result.status).toContain("bad sig");
    fetchSpy.mockRestore();
  });

  it("returns ok when the Edge Function verifies the proof", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ verified: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await signQuestProof({
      wallet: fakeWallet(async () => "0xsig"),
      supabase: fakeSupabase(),
      questRun,
      walletAddress: "0xabc",
      domain: "example.test",
      supabaseUrl: "https://example.supabase.co/",
      supabasePublishableKey: "anon-key",
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchSpy.mock.calls[0];
    expect(endpoint).toBe(
      "https://example.supabase.co/functions/v1/verify-wallet-proof",
    );
    const requestInit = init as RequestInit;
    expect(requestInit.method).toBe("POST");
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      quest_run_id: questRun.id,
      wallet_address: "0xabc",
      signature: "0xsig",
    });
    expect(result.ok).toBe(true);
    expect(result.signature).toBe("0xsig");
    fetchSpy.mockRestore();
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
