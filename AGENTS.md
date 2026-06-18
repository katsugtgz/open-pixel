# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-18
**Commit:** d836ebe
**Branch:** fix/uiux

## OVERVIEW

Open Pixel is a Zero Cup hackathon prototype: a guest-first Web3 pixel quest RPG with a React/Vite claim shell, RPG-JS game, Supabase persistence, and shared wallet-proof helpers.

Locked product line: no token economy, no real RMT, wallet optional only, readable `personal_sign` proof only.

## STRUCTURE

```text
open-pixel/
|-- apps/web/          # React/Vite claim, proof, leaderboard shell
|-- apps/game/         # RPG-JS map, NPC quest, shard gather loop
|-- packages/shared/   # proof message, receipt, shared types, Supabase error helpers
|-- supabase/          # free-tier schema, RLS policies, leaderboard view
|-- docs/              # design/security/submission/deployment decisions
|-- scripts/           # local diagnostics; currently Supabase schema check
`-- assets/            # README/demo/logo placeholders
```

## WHERE TO LOOK

| Task                    | Location                                             | Notes                                       |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Landing/claim/proof UX  | `apps/web/src/App.tsx`, `apps/web/src/App.css`       | Single-page app; wallet proof lives here.   |
| Supabase browser client | `apps/web/src/lib/supabase/client.ts`                | Uses publishable/anon env only.             |
| Quest logic             | `apps/game/src/modules/main/event.ts`                | AI Guide + Pixel Shard state machine.       |
| RPG-JS map wiring       | `apps/game/src/modules/main/server.ts`               | Event placement for `simplemap`.            |
| Game boot               | `apps/game/src/client.ts`, `apps/game/src/server.ts` | RPG-JS client/server providers.             |
| Wallet proof helpers    | `packages/shared/src/index.ts`                       | Message copy, receipt, diagnostics.         |
| Proof/helper tests      | `packages/shared/test/index.test.mjs`                | Build first, then node:test against `dist`. |
| DB/RLS                  | `supabase/schema.sql`                                | Public MVP policies; tighten before prod.   |
| Security rules          | `docs/SECURITY_MODEL.md`, `SECURITY.md`              | Wallet safety guardrails.                   |
| Visual style            | `docs/VISUAL_STYLE.md`, `apps/web/src/App.css`       | Pixel/cozy palette and UI constraints.      |

## CODE MAP

LSP/codegraph tools were not exposed in this Codex surface; map below is from `rg`/shell discovery.

| Symbol                | Type                 | Location                              | Refs            | Role                                 |
| --------------------- | -------------------- | ------------------------------------- | --------------- | ------------------------------------ |
| `App`                 | React component      | `apps/web/src/App.tsx`                | central         | Composes full claim/proof shell.     |
| `ClaimSection`        | React component      | `apps/web/src/App.tsx`                | local           | Guest badge + wallet actions UI.     |
| `signProof`           | async fn             | `apps/web/src/App.tsx`                | central         | Calls `personal_sign`, stores proof. |
| `claimGuestBadge`     | async fn             | `apps/web/src/App.tsx`                | central         | Writes `players` and `quest_runs`.   |
| `createClient`        | fn                   | `apps/web/src/lib/supabase/client.ts` | web             | Supabase SSR browser client wrapper. |
| `buildProofMessage`   | fn                   | `packages/shared/src/index.ts`        | web/tests       | Human-readable wallet proof text.    |
| `SECURITY_RECEIPT`    | const                | `packages/shared/src/index.ts`        | web/tests       | Visible no-tx/no-approval receipt.   |
| `formatSupabaseError` | fn                   | `packages/shared/src/index.ts`        | web/tests       | Schema-missing diagnostics.          |
| `QuestGiver`          | RPG-JS event factory | `apps/game/src/modules/main/event.ts` | map             | Starts/completes 3-shard quest.      |
| `PixelShard`          | RPG-JS event factory | `apps/game/src/modules/main/event.ts` | map             | Collectible shard interaction.       |
| `provideMain`         | provider fn          | `apps/game/src/modules/main/index.ts` | game server     | Registers main RPG-JS module.        |
| `leaderboard`         | SQL view             | `supabase/schema.sql`                 | web data target | Aggregates completed quest scores.   |

## CONVENTIONS

- NPM workspaces: root scripts fan out to `apps/*` and `packages/*`.
- `apps/web` uses React 19 + Vite 8 + Tailwind 4 dependency stack, but current styling is hand-authored CSS.
- Web imports shared package via `@open-pixel/shared`; shared tests import built `../dist/index.js`.
- Supabase env names accepted by web: `VITE_SUPABASE_URL` plus `VITE_SUPABASE_PUBLISHABLE_KEY` or legacy `VITE_SUPABASE_ANON_KEY`.
- `build:vercel` builds all workspaces, then copies `apps/game/dist` into `apps/web/dist/game`.
- `apps/game/src/tiled/*.tsx` includes large generated tileset exports; avoid manual style refactors there.

## ANTI-PATTERNS (THIS PROJECT)

- Do not add token, staking, marketplace, RMT, swap, permit, approval, transaction, contract-call, or `setApprovalForAll` flows without explicit review.
- Do not require wallet connection for play or guest badge claim.
- Do not hide/remove the wallet security receipt when touching proof UX.
- Do not commit `.env`, service-role keys, private keys, mnemonics, or signatures intended to stay private.
- Frontend may use Supabase publishable/anon key only; never service role.
- Do not treat current Supabase public MVP RLS policies as production-ready auth.

## UNIQUE STYLES

- Copy must keep the safety promise visible: guest-first, no token, no gas, no approvals, `personal_sign` only.
- Core loop is fixed: guest player -> AI Guide NPC -> gather 3 Pixel Shards -> earn off-chain points -> guest badge -> optional wallet proof -> leaderboard.
- Visual direction is cozy pixel RPG, not DeFi dashboard. See `docs/VISUAL_STYLE.md` before UI changes.
- Demo speed matters more than production completeness; preserve the contest-demo path.

## COMMANDS

```bash
npm install
npm run dev:web
npm run dev:game
npm run build
npm run typecheck
npm run test
npm run format:check
npm run db:check
npm audit --omit=dev
```

## NOTES

- Run `npm run build` before claiming implementation work done.
- Current GitHub token note from prior docs: workflow-scope may be missing, so `.github/workflows/ci.yml` can fail to push until token permissions change.
- `supabase/schema.sql` intentionally allows public MVP reads/inserts/updates; docs say tighten before production.
- Large code count is dominated by generated RPG-JS tiled exports, especially water/base tiles.
