const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const targets = [
  {
    name: "players",
    columns: ["guest_id", "wallet_address", "display_name"],
  },
  {
    name: "quest_runs",
    columns: [
      "id",
      "guest_id",
      "display_name",
      "quest_id",
      "points",
      "shards",
      "completed_at",
    ],
  },
  {
    name: "wallet_proofs",
    columns: [
      "quest_run_id",
      "wallet_address",
      "message",
      "signature",
      "method",
      "verified_at",
    ],
  },
  {
    name: "leaderboard",
    columns: ["guest_id", "display_name", "total_points", "completed_runs"],
  },
];

if (!url || !key) {
  console.error(
    "Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY.",
  );
  process.exit(2);
}

let failed = false;

for (const target of targets) {
  const select = encodeURIComponent(target.columns.join(","));
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${target.name}?select=${select}&limit=1`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    failed = true;
    console.error(
      `${target.name}: HTTP ${response.status}; expected columns ${target.columns.join(", ")}; ${text}`,
    );
  } else {
    console.log(`${target.name}: ok (${target.columns.join(", ")})`);
  }
}

if (failed) {
  console.error(
    "\nRun supabase/schema.sql in Supabase SQL editor, then rerun this check.",
  );
  process.exit(1);
}
