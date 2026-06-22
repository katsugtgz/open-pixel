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

## AI GAME E2E / SMOKE TEST

- For gameplay, map, sprites, RPG-JS config, quest events, NPCs, shards, input, or build-output changes, run `npm run build:vercel && npm run test:game:render && npm run test:game:ai`.
- `npm run test:game:ai` invokes `scripts/ai-game-smoke.mjs`: screenshot-driven autonomous smoke runner over the real RPG-JS canvas.
- CI runs the AI smoke test on PR/push and uploads `artifacts/ai-game-smoke/` reports/screenshots.
- For full autonomous VLM QA, run `npm run test:game:agent` with `AI_GAME_VLM_BASE_URL`, `AI_GAME_VLM_MODEL`, and `AI_GAME_VLM_API_KEY` set.
- Full AI tester files: `scripts/run-ai-game-e2e.sh`, `scripts/ai-game-agent-runner.py`, `requirements-ai-game-e2e.txt`, `docs/AI_GAME_AGENT_WORKFLOW.md`.
- See `docs/AI_GAME_E2E.md` and `docs/AI_GAME_AGENT_WORKFLOW.md` before changing the harness or bypassing failures.
- Do not fix AI smoke/agent failures by hiding/replacing the RPG-JS canvas with DOM fallback.

## RPG-JS GAME INTEGRITY

- The game is an RPG-JS v5 game. Treat the RPG-JS canvas, Tiled maps, spritesheets, NPCs, terrain, beach/water scenery, trees, and in-engine movement as the source of truth.
- Do not replace, cover, hide, fake, or visually override the RPG-JS game with a DOM/HTML/CSS mock game, fallback board, canvas overlay, square-grid prototype, or custom movement layer.
- Do not set `#rpg canvas { opacity: 0 }`, hide the canvas, or place a full-screen layer above the RPG-JS scene to make a bug look fixed.
- If the map already renders with the RPG-JS art/assets, preserve that look. Fix controls, quest events, sprites, coordinates, or RPG-JS config in the engine instead of rebuilding the game outside RPG-JS.
- If the RPG-JS scene breaks or renders blank, stop and debug the RPG-JS pipeline: Vite server, `@rpgjs/*` versions, `@canvasengine/*`, Pixi, Tiled TMX/TSX loading, spritesheets, and server/client providers. Do not ship a fake DOM replacement as a workaround.
- Use RPG-JS v5 resources before changing game architecture:
  - Docs: `https://rpgjs.dev/`
  - Source/version reference: `https://github.com/RSamaium/RPG-JS#v5`
  - Skill install/reference command when needed: `npx skills add https://github.com/RSamaium/RPG-JS#v5`
- For game QA, verify the actual RPG-JS scene: visible map art, player sprite, NPC sprite, shard sprite/marker, keyboard movement, Space interaction, mobile GUI/A-button behavior if enabled, and quest progress text/notifications.
- Any temporary diagnostic overlay must be small, clearly diagnostic, and removed before handing the build back unless the user explicitly approves it.

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

## LOCAL DEMO URLS

- Local demo servers must bind to `0.0.0.0` so they are reachable through Tailscale and the LAN subnet.
- When starting or testing local demo servers, always report specific click-ready URLs for localhost, Tailscale, and LAN IP with the exact port actually assigned by Vite.
- Current host examples: Tailscale `100.96.209.17`, LAN `192.168.1.5`.
- Example format after server startup:
  - Web: `http://localhost:5173/`, `http://100.96.209.17:5173/`, `http://192.168.1.5:5173/`
  - Game: `http://localhost:5174/`, `http://100.96.209.17:5174/`, `http://192.168.1.5:5174/`
- If Vite picks fallback ports like `5175` or `5176`, report those exact ports instead of the examples.
- This Tailscale/LAN URL reporting rule is only for local demo/testing. Do not use Tailscale/LAN URLs for production deployment guidance.

## NOTES

- Run `npm run build` before claiming implementation work done.
- Current GitHub token note from prior docs: workflow-scope may be missing, so `.github/workflows/ci.yml` can fail to push until token permissions change.
- `supabase/schema.sql` intentionally allows public MVP reads/inserts/updates; docs say tighten before production.
- Large code count is dominated by generated RPG-JS tiled exports, especially water/base tiles.
