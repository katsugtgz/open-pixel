# Open Pixel agent guidelines

## Project root

Always work from:

```bash
cd /home/katsu/open-pixel
```

## Product context

Open Pixel is a Zero Cup hackathon prototype: an AI-native Web3 pixel quest RPG inspired by cozy social worlds like Pixels.xyz.

Locked scope:

- Contest demo first.
- No token.
- No real RMT.
- Guest-first onboarding.
- Wallet optional only.
- Web3 proof uses readable `personal_sign` only.
- Never add tx, approval, swap, permit, `setApprovalForAll`, or marketplace order signing without explicit review.

Core loop:

```text
guest player -> AI Guide NPC -> gather 3 Pixel Shards -> earn off-chain points -> guest badge -> optional wallet proof -> leaderboard
```

## Repo layout

```text
apps/game        RPG-JS game: map, NPC, quest, gather loop
apps/web         React/Vite landing + claim + wallet proof UX
packages/shared  proof helpers + shared types
supabase          schema/RLS SQL
docs              design, security, roadmap, assets, submission notes
assets            README media/logo/demo placeholders
```

## Commands

```bash
npm install
npm run dev:game
npm run dev:web
npm run format:check
npm run build
npm audit --omit=dev
```

## Important docs

- `README.md` — public project overview.
- `docs/DESIGN.md` — locked design decisions.
- `docs/SECURITY_MODEL.md` — wallet safety rules.
- `docs/SUBMISSION.md` — hackathon form draft.
- `docs/ASSETS.md` — asset/license notes.
- `docs/VISUAL_STYLE.md` — Pixels-inspired palette/style guardrails.
- `supabase/schema.sql` — Supabase free-tier schema + RLS.

## Git/GitHub state

Remote repo:

```text
https://github.com/katsugtgz/open-pixel
```

Current pushed branch: `main`.

Known issue: current GitHub token lacks `workflow` scope, so `.github/workflows/ci.yml` is local-only/untracked unless token is refreshed with `workflow` permission.

## Safety rules

- Never commit `.env` or service-role keys.
- Frontend may use Supabase anon key only.
- Keep wallet proof optional.
- If touching wallet code, preserve the visible security receipt.
- Run `npm run build` before claiming done.
