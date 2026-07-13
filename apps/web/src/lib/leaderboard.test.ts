import { describe, expect, it } from "vitest";
import { DEMO_LEADERBOARD_ROWS, type LeaderboardRow } from "@open-pixel/shared";
import { loadLeaderboard } from "./leaderboard";

type FakeResult = { data: LeaderboardRow[] | null; error?: unknown };

type FakeQuery = {
  order(column?: string, options?: { ascending?: boolean }): FakeQuery;
  limit(
    count?: number,
  ): Promise<{ data: LeaderboardRow[] | null; error: unknown }>;
};

// Fake SupabaseAdapter: select().order()...order().limit() resolves the result.
function fakeSupabase(result: FakeResult) {
  const query: FakeQuery = {
    order: () => query,
    limit: () =>
      Promise.resolve({ data: result.data, error: result.error ?? null }),
  };
  return { from: () => ({ select: () => query }) };
}

describe("loadLeaderboard", () => {
  it("falls back to demo rows when supabase is null", async () => {
    const result = await loadLeaderboard(null);
    expect(result.source).toBe("demo");
    expect(result.rows).toEqual(DEMO_LEADERBOARD_ROWS);
  });

  it("falls back to demo with a status when the query errors", async () => {
    const result = await loadLeaderboard(
      fakeSupabase({ data: null, error: { message: "down" } }),
    );
    expect(result.source).toBe("demo");
    expect(result.status).toContain("Leaderboard unavailable");
  });

  it("falls back to demo when no rows are returned", async () => {
    const result = await loadLeaderboard(fakeSupabase({ data: [] }));
    expect(result.source).toBe("demo");
  });

  it("maps supabase rows and tags proof readiness", async () => {
    const rows: LeaderboardRow[] = [
      { display_name: "Alice", total_points: 200, has_proof: true },
      { display_name: "Bob", total_points: 100, has_proof: false },
    ];
    const result = await loadLeaderboard(fakeSupabase({ data: rows }));
    expect(result.source).toBe("supabase");
    expect(result.rows).toEqual([
      { name: "Alice", score: 200, tag: "proof ready" },
      { name: "Bob", score: 100, tag: "guest" },
    ]);
  });
});
