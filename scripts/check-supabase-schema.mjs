import { SUPABASE_SCHEMA_TARGETS } from "@open-pixel/shared";

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY.",
  );
  process.exit(2);
}

let failed = false;

for (const target of SUPABASE_SCHEMA_TARGETS) {
  const columns = [...target.columns];
  const select = encodeURIComponent(columns.join(","));
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
      `${target.name}: HTTP ${response.status}; expected columns ${columns.join(", ")}; ${text}`,
    );
  } else {
    console.log(`${target.name}: ok (${columns.join(", ")})`);
  }
}

if (failed) {
  console.error(
    "\nRun supabase/schema.sql in Supabase SQL editor, then rerun this check.",
  );
  process.exit(1);
}
