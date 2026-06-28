# Resource-Village Deterministic Packet

This packet is the handoff contract for implementing the Cozy Resource-Village Loop.
Agents must read this before implementing gameplay issues #16, #17, #18, or #20.

It is the Wave 0 anchor for a ten-task plan (W0.1 through W4.2). Later waves
consume this packet as the canonical spec for asset choices, Tiled object
grammar, module file paths, and QA gates. Sections are numbered from two
onward; the Firecrawl Research Pack above is section one.

## Firecrawl Research Pack

Firecrawl was used to collect repeatable context. API keys are env-only and must
never be committed.

Saved artifacts:

- `.firecrawl/firecrawl-cli-doc.json`
- `.firecrawl/firecrawl-ai-onboarding.json`
- `.firecrawl/firecrawl-changelog.json`
- `.firecrawl/map-firecrawl-docs.json`
- `.firecrawl/map-tiled-docs.json`
- `.firecrawl/tiled-objects-doc.json`
- `.firecrawl/tiled-custom-properties-doc.json`
- `.firecrawl/phaser-tilemap-doc.json`
- `.firecrawl/kenney-assets.json`
- `.firecrawl/search-tiled-resource-node-workflow.json`
- `.firecrawl/search-farming-loop-implementation.json`
- `.firecrawl/game-asset-pipeline-qa.json`

Reusable commands:

```bash
export FIRECRAWL_API_KEY=...
firecrawl scrape https://docs.firecrawl.dev/sdks/cli --output .firecrawl/firecrawl-cli-doc.json
firecrawl scrape https://docs.firecrawl.dev/ai-onboarding --output .firecrawl/firecrawl-ai-onboarding.json
firecrawl scrape https://www.firecrawl.dev/changelog --output .firecrawl/firecrawl-changelog.json
firecrawl map https://docs.firecrawl.dev --search 'CLI scrape search map agent onboarding' --limit 20 --output .firecrawl/map-firecrawl-docs.json
firecrawl scrape https://doc.mapeditor.org/en/stable/manual/objects/ --output .firecrawl/tiled-objects-doc.json
firecrawl scrape https://doc.mapeditor.org/en/stable/manual/custom-properties/ --output .firecrawl/tiled-custom-properties-doc.json
firecrawl search 'Tiled custom properties object templates game workflow resource nodes' --limit 8 --sources web --scrape --output .firecrawl/search-tiled-resource-node-workflow.json
firecrawl search 'farming game inventory order fulfillment resource loop implementation 2D' --limit 8 --sources web --scrape --output .firecrawl/search-farming-loop-implementation.json
```

## Product Direction

The game is not an AI Guide plus three collectible markers. The target loop is:

1. Move through a coherent farm/resource village.
2. Perform direct resource actions.
3. See inventory/resource progress.
4. Fulfill one small order at a workstation or task board.
5. Receive visible off-chain completion feedback.

NPCs can explain or decorate. NPCs must not gate the main loop.

## Asset Manifest Requirements

### §2 Asset Manifest

Before map or interaction work starts, every asset bundle is pinned with a
stable id, source URL, license, tile size, usage role, preview path, and
normalization rule. The table below is the authoritative manifest for the
village loop. Any bundle not listed here is out of scope for the hackathon
slice.

| id | source_url | license | tile_size | usage_role | preview_path | normalization_notes |
|----|------------|---------|-----------|------------|--------------|---------------------|
| `lpc-base` | https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles | CC-BY-SA 3.0 / GPL3 | 32x32 | terrain, structures, and characters with the full LPC attribution chain | `assets/preview/lpc-base.png` | Primary 32px base for the village. Carry the full attribution chain into `CREDITS.txt`. |
| `lpc-farm` | https://opengameart.org/content/lpc-farm + https://opengameart.org/content/lpc-farming | CC-BY 4.0 (bluecarrot16) | 32x32 | farm plots, crops, trees, and fences | `assets/preview/lpc-farm.png` | Same 32px scale and compatible palette as `lpc-base`, so the two may share a layer. |
| `dungeon-mine-0x72` | https://0x72.itch.io/dungeontileset-ii | CC0 1.0 | 16x16 | mine sub-area only: rocks, ore, crystals | `assets/preview/dungeon-mine.png` | Scope to a dedicated mine zone. Either 2x upscale to 32px or keep on a separate 16px Tiled layer. Never mix with 32px LPC on the same Tiled layer. |
| `pipo-legacy` | in-repo `[Base]BaseChip_pipo.png` and related chips | custom (frozen) | 32x32 | backdrop tiles only, preserving the existing daytime village look | `assets/preview/pipo-legacy.png` | Frozen. Do not extend. Backdrop-only role, see Appendix A. |

Pin every URL in `CREDITS.txt` at the repo root and keep the per-file author
chain next to it. The standard per-file license split (assets CC-BY-SA, CC-BY,
or CC0; code MIT) does not contaminate the MIT codebase. Asset licenses attach
to the asset files and their attribution chain, while the code stays MIT. Reject
any pack that is NC-only or marked "no redistribute". Specifically excluded:
the shubibubi "Cozy Farm" free pack, the sanctumpixel "Village" pack, and any
similar NC or no-redistribute bundle. If a desired pack's license is unknown,
stop at the Stop Conditions and update #21 instead of importing.

## Tiled Object Grammar

### §3 Tiled Object Grammar, including the §3.1 RPG-JS v5 Workaround Mandate

The village map (`apps/game/src/tiled/village.tmx`, see Appendix B) uses six
object layers. Each gameplay object must carry the custom properties listed
below, or the gameplay code will not bind to it.

Object layers (one responsibility each):

- `spawn` - player start position and any warp-in points.
- `collisions` - solid rectangles the player cannot walk through: walls, water, fences.
- `resource_nodes` - trees and mine nodes that yield wood, stone, or crystal.
- `farm_plots` - tillable plots the player plants, waters, and harvests.
- `workstations` - crafting or order-fulfillment stations plus the order board.
- `decor` - non-interactive scenery such as flowers, lamps, and signs; no gameplay effect.

Required custom properties on every gameplay object:

- `kind` - one of `plot`, `tree`, `mine`, `workstation`, `board`, `spawn`, or `collision`.
- `id` - stable unique id, for example `plot_01`, `tree_03`, `mine_01`, `board_orders`.
- `resource` - one of `crop`, `wood`, `stone`, `crystal`, or `none`.
- `action` - one of `plant`, `water`, `harvest`, `chop`, `mine`, `fulfill`, or `inspect`.
- `requiresTool` - one of `none`, `hoe`, `can`, `axe`, or `pickaxe`.
- `initialState` - one of `empty`, `planted`, `watered`, `grown`, `ready`, `depleted`, or `active`.
- `rewardItem` - item id awarded by the interaction, for example `Popberry`.
- `orderId` - order id when `kind` is `workstation` or `board`.

Naming convention. The Tiled object `name` MUST equal the eventual RPG-JS event
id. The Tiled object `class` field (Tiled 1.9 and newer) or `type` field
(Tiled 1.8) MUST equal `kind`. If a map object lacks `kind` and a stable `id`,
gameplay code must not bind to it.

#### RPG-JS v5 Workaround Mandate

Warning. Tiled custom properties DO NOT auto-flow to an `EventDefinition` in
RPG-JS v5. At map load the runtime reads only `obj.name` (matched to
`event.name` so that `{x, y}` is injected onto the event), `obj.x`, `obj.y`,
`obj.point`, and `obj.class === 'start'`. The custom properties array is
invisible to event factories unless an adapter reads it explicitly.

Source of truth. RPG-JS v5 file `packages/tiledmap/src/physics.ts` lines 35-65
confirms that only `name`, `x`, `y`, `point`, and `class` are auto-injected.
Docs root: https://v5.rpgjs.dev. Repo v5 commit permalink:
https://github.com/RSamaium/RPG-JS/commit/be52542a45eaf52c8454ad9ca8f5f163321ff7aa
(hash `be52542a45eaf52c8454ad9ca8f5f163321ff7aa`).

Because of this, the village module MUST register a map adapter that walks each
object layer, reads the custom properties by hand, and creates dynamic events
with stable ids. This adapter is stubbed in W1.3 and implemented in W2.2. The
mandatory shape:

```ts
// apps/game/src/modules/village/map-adapter.ts (W1.3 stub, W2.2 implements)
map.onLoad((m) => {
  const layer = m.getLayerByName('farm_plots');
  if (!layer) return;
  for (const obj of layer.objects) {
    const props = Object.fromEntries(
      (obj.properties ?? []).map(p => [p.name, p.value])
    );
    m.createDynamicEvent({
      id: obj.name,        // MUST equal obj.name; stable id like 'plot_01'
      x: obj.x,
      y: obj.y,
      event: CropPlotFactory(props),  // factory attaches props via [key:string]: unknown
    });
  }
});
```

The `id: obj.name` line is mandatory. RPG-JS matches dynamic event ids to map
object names, and any mismatch drops the `{x, y}` injection. Each event factory
(`CropPlotFactory`, `TreeFactory`, `MineFactory`, `OrderBoardFactory`) takes the
parsed `props` object and returns an `EventDefinition` that stores the props on
the event for later state-machine use.

## Module Contracts

### §4 Module Contract (file-path map)

The village loop lives under `apps/game/src/modules/village/`. Each file has one
job and a small public interface. Stubs created in W1.3 throw
`Error('W1.3 stub: <fn>')`; real implementations land in W2.2 and W3.1.

| path | primary export | purpose |
|------|----------------|---------|
| `apps/game/src/modules/village/index.ts` | `provideVillage` | Provider that registers village events, items, and the map adapter into the RpgServer. |
| `apps/game/src/modules/village/state.ts` | `ResourceState`, `ResourceKind`, `PlotState` types plus pure fns | Owns resource and plot state types and the pure state-machine transitions. No side effects. |
| `apps/game/src/modules/village/inventory.ts` | `class Inventory` | Owns item counts and item mutations. Single source of truth for "how many the player has". |
| `apps/game/src/modules/village/orders.ts` | `Order`, `OrderBoard`, `fulfillOrder` | Owns order definitions, fulfillment checks, and reward payout. |
| `apps/game/src/modules/village/map-adapter.ts` | `registerMapObjects` | The `map.onLoad` workaround described above. Reads Tiled object layers and creates dynamic events. |
| `apps/game/src/modules/village/hud-adapter.ts` | `renderHud` | Read-only projection of player variables into a HUD shape. Does not own game truth. |
| `apps/game/src/modules/village/proof-bridge.ts` | `emitCompletion` | Calls `player.emit('village:complete', payload)` where payload matches the W1.2 `QuestRun.resources` shape. |
| `apps/game/src/modules/village/items.ts` | `@Item` classes | Item definitions registered through `provideServerModules([{ database: { ... } }])` in `apps/game/src/server.ts`. |
| `apps/game/src/modules/village/events/crop-plot.ts` | `CropPlotFactory` | Event factory for farm plots. Owns plant, water, and harvest transitions. |
| `apps/game/src/modules/village/events/tree.ts` | `TreeFactory` | Event factory for trees. Owns the chop loop and wood rewards. |
| `apps/game/src/modules/village/events/mine.ts` | `MineFactory` | Event factory for mine nodes. Owns the mine loop and stone or crystal rewards. |
| `apps/game/src/modules/village/events/order-board.ts` | `OrderBoardFactory` | Event factory for the order board and workstations. Owns inspect and fulfill. |
| `apps/game/src/modules/village/events/index.ts` | barrel re-exports | Re-exports all factories so the map adapter imports them from one path. |

Public interface signatures (TypeScript). Implementations match these signatures
exactly; the union string sets are the single source of truth for `kind`,
`resource`, `action`, `requiresTool`, and state values.

```ts
// apps/game/src/modules/village/index.ts
export function provideVillage(): RpgServerModule;

// apps/game/src/modules/village/state.ts
export type ResourceKind = 'crop' | 'wood' | 'stone' | 'crystal' | 'none';
export type PlotState = 'empty' | 'planted' | 'watered' | 'grown' | 'ready';
export type NodeState = 'ready' | 'depleted' | 'active';
export function advancePlotState(s: PlotState): PlotState;
export function transitionNodeState(s: NodeState, action: string): NodeState;
export function pointsFromCompletion(s: PlotState): number;

// apps/game/src/modules/village/inventory.ts
export type InventoryShape = Record<string, number>;
export class Inventory {
  add(item: string, qty: number): void;
  count(item: string): number;
  consume(item: string, qty: number): boolean;
  snapshot(): Readonly<InventoryShape>;
}

// apps/game/src/modules/village/orders.ts
export interface Order { id: string; requires: Record<string, number>; rewardPoints: number; }
export type OrderBoard = { orders: Order[] };
export interface FulfillmentResult { ok: boolean; awardedPoints: number; remaining: InventoryShape; }
export function fulfillOrder(player: RpgPlayer, orderId: string): FulfillmentResult;

// apps/game/src/modules/village/map-adapter.ts
export function registerMapObjects(map: RpgMap): void;

// apps/game/src/modules/village/hud-adapter.ts
export interface HudModel { points: number; inventory: InventoryShape; activeOrder: Order | null; }
export function renderHud(player: RpgPlayer): HudModel;

// apps/game/src/modules/village/proof-bridge.ts
export function emitCompletion(player: RpgPlayer): void;

// apps/game/src/modules/village/items.ts
@Item class Popberry {}
@Item class PopberrySeeds {}
@Item class WhittlewoodLog {}
@Item class OchruxMatrix {}

// apps/game/src/modules/village/events/*.ts
export function CropPlotFactory(props: PlotProps): EventDefinition;
export function TreeFactory(props: NodeProps): EventDefinition;
export function MineFactory(props: NodeProps): EventDefinition;
export function OrderBoardFactory(props: BoardProps): EventDefinition;
```

Hard rule. Do not store core game state only in DOM, HUD text, or notification
strings. The HUD adapter and proof bridge are projections; `state.ts`,
`inventory.ts`, and `orders.ts` own the truth.

## §5 Energy/Economy Decision

For the hackathon vertical slice (W1.4, W2.2, W3.1) every resource action costs
zero energy. The loop is free to play so a guest can finish the demo without
grinding. Off-chain points are the only reward currency and they feed the
optional `personal_sign` proof.

Points formula (off-chain, stored in the player variable `village.points`):

| action | energy cost | points |
|--------|-------------|--------|
| plant | 0 | +0 |
| water | 0 | +0 |
| harvest | 0 | +5 per harvested crop |
| chop (per swing) | 0 | +3 |
| mine | 0 | +4 |
| fulfill order | 0 | +order_value (default 25) |

Future work (post issue #17, out of scope for the hackathon slice): introduce an
Energy item with per-action costs of 0.5 plant, 0.5 water, 1.5 chop-swing, and
5.5 house-enter, following the Pixels.xyz reference. That work is gated on a
separate energy-balance task and must not be folded into the village loop
without a fresh decision recorded here.

Locked product line (non-negotiable). No tokens, no gas, no approvals, no
marketplace, no staking, no swaps, no permits, no contract calls, no
`setApprovalForAll`. Points are off-chain only and flow exclusively through the
W3.1 proof bridge into the optional readable `personal_sign` message.

## QA Gates

### §6 QA Artifact Plan

Local demo servers bind to `0.0.0.0` per AGENTS.md so they are reachable on
localhost, Tailscale, and the LAN. After W2.1 the game serves the village map.

Game URLs:

- http://localhost:5174/
- http://100.96.209.17:5174/ (Tailscale)
- http://192.168.1.5:5174/ (LAN)

Web shell URLs (same hosts on port 5173):

- http://localhost:5173/
- http://100.96.209.17:5173/
- http://192.168.1.5:5173/

If Vite picks a fallback port (5175, 5176, and so on), report the actual port in
the QA artifact filename.

Required `/vision-9router` screenshots per acceptance criterion:

- Issue #18 first viewport (1 shot). House exterior, workshop exterior, at least
  three farm plots, at least two trees, at least one mine node, and connecting
  paths all visible in the initial viewport.
- Issue #16 resource actions (9 shots). Pre, during, and post states for each of
  plot, tree, and mine (three actions times three states).
- Issue #17 inventory and fulfillment (4 shots). HUD baseline, harvest count-up,
  order board inspect, and fulfill points-up.
- Issue #20 smoke regression (1 shot). The DOM-mock injection detector flags a
  hidden or faked canvas as a failure.

Selectors the vision agent and the smoke harness rely on:

- `#rpg canvas` - the RPG-JS PIXI canvas is present and non-empty.
- `.rpg-ui-dialog-body` - RPG-JS text dialog body.
- `.quest-hint` - controls hint. Replaced by the W4.1 hint overlay; do not
  remove earlier than W4.1.
- `.village-hud` - new. Added by the W3.1 HUD adapter.
- `.order-board` - new. Added by the W3.1 order-board event.

Pass and fail language is binary and observable per scenario:

- #18 PASS iff the vision agent reports all six elements (house, at least three
  plots, at least two trees, at least one mine, paths, workstation) visible in
  the initial-viewport screenshot. Otherwise FAIL.
- #16 PASS iff each of the nine pre, during, and post shots shows the expected
  state transition for its action. Otherwise FAIL.
- #17 PASS iff the harvest shot shows a +count, the inspect shot shows the
  order, and the fulfill shot shows +points. Otherwise FAIL.
- #20 PASS iff the DOM-mock detector rejects a hidden or faked canvas.
  Otherwise FAIL.

Automation limits. PIXI canvas automation goes through `window.__PIXI_STAGE__`,
already wired in `scripts/ai-game-smoke.mjs`. Custom action inputs (plant,
water, chop, mine, fulfill) must go through `player.onInput`, not
`event.onAction`, because RPG-JS v5 routes player input through the player
proxy. Document any case where the harness cannot drive an action and fall back
to a human keyboard smoke with screenshots attached.

## §7 Forbidden Patterns

Each entry below is a hard "do not". The rationale is one line.

- DOM fake gameplay rendered above the canvas. Violates PRD #15 "preserve
  RPG-JS canvas".
- `#rpg canvas { opacity: 0 }`, `display: none`, or any canvas hide. Same
  violation; never mask a broken scene.
- Mixed tilesets on one Tiled layer without an explicit normalization note. PRD
  anti-pattern; produces visual incoherence.
- NPC dialogue as the main-loop gate. PRD anti-pattern; NPCs decorate only.
- Engine switch to Phaser, Godot, or a custom canvas without a documented
  spike. PRD anti-pattern; the game stays on RPG-JS v5.
- `setApprovalForAll`, token economy, marketplace, staking, swaps, permits,
  approvals, or any contract call. Locked product line.
- Service-role Supabase key in the browser. Security rule; the frontend uses the
  publishable or anon key only.
- Committing `.env`, service-role keys, private keys, mnemonics, or signatures
  intended to stay private. Security rule.
- `as any`, `@ts-ignore`, or `@ts-expect-error`. Type safety; fix the type
  instead.
- Empty `catch (e) {}` blocks. Error handling; at minimum log or rethrow.
- Deleting failing tests to pass. Testing integrity; fix the code or mark the
  test skipped with a reason.
- Mixing LPC (32x32) with the 0x72 dungeon tileset (16x16) on the same Tiled
  layer. Visual incoherence; use separate layers or separate map zones (see the
  `dungeon-mine-0x72` normalization notes in the asset table).

## Stop Conditions

Stop and update #21 instead of coding when:

- Asset source/license is unknown.
- Tile size/scale is unknown.
- Tiled object grammar is missing.
- Resource module ownership is unclear.
- QA screenshots cannot be produced.
- The implementation starts reverting to NPC dialogue plus three pickups.

## Appendix A - Conflict Resolutions (locked)

These decisions are locked by Sisyphus. Do not re-litigate them during
implementation.

- Matrix id: `OchruxMatrix`. The Pixels.xyz gated-field reference is the most
  granular naming and the village loop adopts it verbatim.
- Harvest step: in scope for issue #16. W2.2 implements plant, water, and
  harvest on the `CropPlot` event.
- Mine cost: zero. Mining is a free action for the hackathon slice.
- House-enter cost: deferred. Every action costs zero energy for the hackathon
  slice (see the Energy/Economy Decision above).
- Backdrop: preserve the existing pipo daytime look. Do not add a space-island
  or night backdrop.
- Top-left secondary counter: the single "gems" pill is deferred. The HUD shows
  resources only (crops, wood, stone, crystal, points).

## Appendix B - Open Implementation Decisions (locked by Sisyphus)

These are locked implementation choices. Do not re-litigate them during
implementation.

- Map scope: new `apps/game/src/tiled/village.tmx`, 40 by 40 tiles, a 1280 by
  1280 pixel world. Keep `simplemap.tmx` frozen. W2.1 swaps the player spawn
  with `changeMap('village')` in `apps/game/src/modules/main/player.ts`.
- Save key: bump the LocalStorageSave key from `'save'` to `'save-village'` for
  clean dev state. W2.1 also adds a production-followup code comment in
  `apps/game/src/server.ts` to migrate legacy `'save'` keys.
- AI Guide NPC: delete entirely in W2.2. The legacy
  `apps/game/src/modules/main/event.ts` deletion covers it. No flavor NPC at
  start.
- Commit strategy: ten atomic commits on `feat/resource-village-loop`, one per
  task id (W0.1 through W4.2). Preserve all ten; do not squash. The PR opens
  after Wave 4.
