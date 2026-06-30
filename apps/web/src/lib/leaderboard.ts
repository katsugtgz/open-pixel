import {
  DEMO_LEADERBOARD_ROWS,
  formatSupabaseError,
  SUPABASE_COLUMNS,
  SUPABASE_TABLES,
  toLeaderboardEntry,
  type LeaderboardEntry,
  type LeaderboardRow,
} from "@open-pixel/shared";

type SupabaseAdapter = {
  from(table: string): {
    select(columns: string): {
      order(
        column: string,
        options?: { ascending?: boolean },
      ): {
        limit(count: number): PromiseLike<{
          data: LeaderboardRow[] | null;
          error: unknown | null;
        }>;
      };
    };
  };
};

export type LeaderboardResult = {
  rows: LeaderboardEntry[];
  source: "supabase" | "demo";
  status?: string;
};

export async function loadLeaderboard(
  supabase: SupabaseAdapter | null,
): Promise<LeaderboardResult> {
  if (!supabase) {
    return {
      rows: DEMO_LEADERBOARD_ROWS,
      source: "demo",
      status: "Demo leaderboard shown. Add Supabase env to load live scores.",
    };
  }

  try {
    const { data, error } = await supabase
      .from(SUPABASE_TABLES.leaderboard)
      .select(SUPABASE_COLUMNS.leaderboard.join(","))
      .order("total_points", { ascending: false })
      .limit(10);

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
    return {
      rows: DEMO_LEADERBOARD_ROWS,
      source: "demo",
      status: formatSupabaseError("Leaderboard unavailable", error),
    };
  }
}
