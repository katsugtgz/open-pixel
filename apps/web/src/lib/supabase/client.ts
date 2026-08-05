import { createBrowserClient } from "@supabase/ssr";

// Returns null when the required env is missing rather than throwing —
// callers MUST null-check the result before issuing queries. The web app
// already does this and falls back to demo data when null is returned.
export function createClient() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createBrowserClient(url, key);
}
