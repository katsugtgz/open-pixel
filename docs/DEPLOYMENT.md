# Deployment

## Recommended contest setup

For Zero Cup, Vercel + Supabase free tier is enough.

- Vercel hosts the React claim/landing app and the built RPG-JS game under `/game`.
- Supabase free tier stores players, quest runs, wallet proofs, and leaderboard view.
- A custom top-level domain can be added later from the Vercel dashboard.

## Vercel

This repo includes `vercel.json`.

Build:

```bash
npm run build:vercel
```

Output:

```text
apps/web/dist
apps/web/dist/game  # copied RPG-JS build
```

Required env:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GAME_URL=/game
```

Deploy after Vercel auth:

```bash
npx vercel --prod
```

## Supabase

1. Create a free Supabase project.
2. Open SQL editor.
3. Run `supabase/schema.sql`.
4. Copy project URL and anon key into Vercel env.
5. Never put `service_role` in frontend env.

## Domain

For contest speed, Vercel preview/prod URL is acceptable. Custom TLD is polish, not required for submission.

If using a domain:

1. Add domain in Vercel project settings.
2. Update DNS at registrar.
3. Keep `VITE_GAME_URL=/game`.
4. Update README/demo links after domain resolves.
