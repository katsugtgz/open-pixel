const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

const targets = ["players", "quest_runs", "wallet_proofs", "leaderboard"];

if (!url || !key) {
  console.error(
    "Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY.",
  );
  process.exit(2);
}

let failed = false;

for (const target of targets) {
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${target}?select=*&limit=1`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    failed = true;
    console.error(`${target}: HTTP ${response.status} ${text}`);
  } else {
    console.log(`${target}: ok`);
  }
}

if (failed) {
  console.error(
    "\nRun supabase/schema.sql in the Supabase SQL editor, then rerun this check.",
  );
  process.exit(1);
}
