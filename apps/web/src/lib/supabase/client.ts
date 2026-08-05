import { createBrowserClient } from "@supabase/ssr";

<<<<<<< HEAD
=======
// Returns null when the required env is missing rather than throwing —
// callers MUST null-check the result before issuing queries. The web app
// already does this and falls back to demo data when null is returned.
>>>>>>> origin/main
export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
<<<<<<< HEAD
    throw new Error(
      "Missing VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_ANON_KEY.",
    );
=======
    return null;
>>>>>>> origin/main
  }

  return createBrowserClient(url, key);
}
