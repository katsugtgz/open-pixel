# Docs Audit — 2026-07-01

## Verdict

Docs were split between two product truths:

- old/current implementation: AI Guide plus three Pixel Shards/village nodes;
- target product: **Cozy Resource-Village Loop** with resource actions, inventory/task progress, fulfillment, then optional wallet proof.

Canonical direction is now target product. Old shard/NPC loop remains implementation debt unless explicitly patched as current shipped behavior.

## Canonical Sources

Use this order when documents or code disagree:

1. `CONTEXT.md`
2. `docs/DESIGN.md`
3. GitHub issue #15
4. GitHub issue #21 and `docs/agents/resource-village-deterministic-packet.md`
5. current app code

## Brand Hygiene

Allowed:

- **Open Pixel** — public product brand.
- **Cozy Resource-Village Loop** — internal mechanic/product-loop name.

Avoid as product brands:

- AI Guide quest;
- Pixel Shard quest;
- Infinifunnel-style loop;
- resource-village deterministic packet.

Those may describe history, inspiration, or implementation contracts, but they should not compete with Open Pixel.

## Docs Updated

- `CONTEXT.md` — added canonical terms: Resource Action, Game Completion Receipt, Guest Badge, Wallet Proof.
- `docs/DESIGN.md` — replaced legacy shard MVP loop with target resource-village loop.
- `docs/ROADMAP.md` — moved roadmap to resource actions, fulfillment, and Game Completion Receipt.
- `docs/SUBMISSION.md` — removed Pixel Shard-centered pitch.
- `README.md` — reformatted and aligned with resource-village direction.
- `AGENTS.md` — added current product direction override before stale generated content.
- `apps/game/AGENTS.md` — rewrote game-agent guidance around resource loop and evidence.
- `apps/web/AGENTS.md` — clarified Guest Badge claim must eventually consume Game Completion Receipt.
- `docs/agents/domain.md` — added source order and evidence rule.
- `docs/agents/resource-village-deterministic-packet.md` — rewrote as clean handoff contract.
- `docs/AI_GAME_E2E.md` — added target resource-loop pass criteria.

Note: root `AGENTS.md` still contains older generated lines below the override. Treat the top "CURRENT PRODUCT DIRECTION OVERRIDE" as authoritative until that file is fully regenerated.

## Remaining Stale Surfaces

These are not docs-only cleanup; they require implementation and browser/game verification:

- `apps/web/src/App.tsx` still pitches "restore 3 village nodes" and creates a demo quest run locally.
- `apps/game/src/modules/main/*` still implements AI Guide plus node/shard flow.
- `apps/game/src/config/gameSmokeContract.js` still validates old guide/node text.
- `scripts/ai-game-smoke.mjs` may still optimize for old movement/dialogue goals.
- `supabase/schema.sql` still stores generic `quest_runs`; likely okay short-term, but Game Completion Receipt may need explicit shape later.

## Agent Testing Rule

"Done" means evidence exists. For game work, minimum evidence is:

- build/test command output;
- real RPG-JS canvas screenshot or smoke artifact;
- resource action evidence;
- inventory/task/order progress evidence;
- fulfillment/completion evidence;
- explicit blocker note if automation cannot prove the interaction.

Self-report without artifacts is fail.
