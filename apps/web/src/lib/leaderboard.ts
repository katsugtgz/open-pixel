import {
  DEMO_LEADERBOARD_ROWS,
  formatSupabaseError,
  SUPABASE_COLUMNS,
  SUPABASE_TABLES,
  toLeaderboardEntry,
  type LeaderboardEntry,
  type LeaderboardRow,
} from "@open-pixel/shared";

type LeaderboardQuery = {
  order(column: string, options?: { ascending?: boolean }): LeaderboardQuery;
  abortSignal(signal: AbortSignal): LeaderboardQuery;
  limit(count: number): PromiseLike<{
    data: LeaderboardRow[] | null;
    error: unknown | null;
  }>;
};

type SupabaseAdapter = {
  from(table: string): { select(columns: string): LeaderboardQuery };
};

export type LeaderboardResult = {
  rows: LeaderboardEntry[];
  source: "supabase" | "demo";
  status?: string;
};

export async function loadLeaderboard(
  supabase: SupabaseAdapter | null,
  signal?: AbortSignal,
): Promise<LeaderboardResult> {
  if (!supabase) {
    return {
      rows: DEMO_LEADERBOARD_ROWS,
      source: "demo",
      status: "Demo leaderboard shown. Add Supabase env to load live scores.",
    };
  }

  if (signal?.aborted) {
    return { rows: DEMO_LEADERBOARD_ROWS, source: "demo" };
  }

  try {
    let query = supabase
      .from(SUPABASE_TABLES.leaderboard)
      .select(SUPABASE_COLUMNS.leaderboard.join(","))
      .order("total_points", { ascending: false })
      .order("last_completed_at", { ascending: true });
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query.limit(10);

    if (signal?.aborted) {
      return { rows: DEMO_LEADERBOARD_ROWS, source: "demo" };
    }

    if (error) {
      return {
        rows: DEMO_LEADERBOARD_ROWS,
        source: "demo",
        status: formatSupabaseError("Leaderboard unavailable", error),
      };
    }

    if (!data?.length) {
      return {
        rows: DEMO_LEADERBOARD_ROWS,
        source: "demo",
        status: "Leaderboard empty. Demo rows shown until first live claim.",
      };
    }

    return { rows: data.map(toLeaderboardEntry), source: "supabase" };
  } catch (error) {
    if (signal?.aborted) {
      return { rows: DEMO_LEADERBOARD_ROWS, source: "demo" };
    }
    return {
      rows: DEMO_LEADERBOARD_ROWS,
      source: "demo",
      status: formatSupabaseError("Leaderboard unavailable", error),
    };
  }
}
