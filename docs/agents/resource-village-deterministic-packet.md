# Resource-Village Deterministic Packet

This packet is the handoff contract for implementing the **Cozy Resource-Village Loop**. Agents must read it before implementing gameplay issues #16, #17, #18, or #20.

## Canonical Source Order

When project documents conflict, follow:

1. `CONTEXT.md`
2. `docs/DESIGN.md`
3. GitHub issue #15
4. this packet and GitHub issue #21
5. current game code

Current game code may still contain legacy AI Guide + three Pixel Shards/village nodes. That is implementation debt, not the target loop.

## Firecrawl Research Pack

Firecrawl was used to collect repeatable context. API keys are env-only and must never be committed.

The `.firecrawl/*.json` artifacts listed below are **not committed to this repo**. Treat this committed packet as canonical; the artifact list is only a pointer to what was gathered. Reusable scrape/search/map commands (API key from env only, never committed) live verbatim in GitHub issue #21.

Saved artifacts (reference only, not in repo):

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

## Product Target

The first playable minute should communicate cozy farm/resource village:

- house or workshop;
- farm plots;
- trees or wood source;
- mine, rock, crystal, or stone source;
- visible pathing and reachable interactables;
- inventory or resource counter;
- task board, order board, or workstation;
- fulfillment/completion feedback.

NPCs may exist as helper/tutorial flavor, but they must not gate the main loop.

## Asset Manifest

Any new asset lands in this manifest **before** it lands in the map. No random tileset mixing without explicit normalization.

Pixel-art rendering rule: nearest-neighbor sampling, integer scaling only, no smoothing/blur/antialias on sprites or tiles.

Normalization rule: every sourced group must read as one style. Kenney packs (kenney.nl, CC0) are the default normalization-safe source; resize outside art to the 32px grid before import. Mixing Pipoya + Kenney is allowed only after downscaling/editing so palette, outline weight, and tile size match.

| Asset                               | Source URL / path                                     | License                                                                                                                                                                                                                                                                                                                                                                                                    | Tile size / scale          | Intended use                                                      | Preview path                                                                                                                                             | Status           |
| ----------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Terrain: Pipoya tilesets            | https://pipoya.itch.io/pipoya-rpg-tileset-32x32-pixel | Free for commercial + non-commercial game use; redistributing/reselling the raw asset pack is prohibited. In-repo copies exist only as embedded parts of this game project, not as a redistributable pack. Open license item: confirm public-repo hosting is permitted by the itch.io license text before final submission; if not, move the PNGs out of the repo and load them as an external dependency. | 32x32, scale 1             | Grass, dirt, water, flowers, walls; `[Base]BaseChip` floors/walls | `apps/game/src/tiled/[A]Grass_pipo.png`, `[A]Dirt_pipo.png`, `[A]Water_pipo.png`, `[A]Flower_pipo.png`, `[A]Wall-Up_pipo.png`, `[Base]BaseChip_pipo.png` | in-repo          |
| Hero / Female sprites               | RPG-JS starter repo                                   | MIT. Verify before submission.                                                                                                                                                                                                                                                                                                                                                                             | ~32px char sprite, scale 1 | Player avatar                                                     | `apps/game/public/spritesheets/hero.png`, `female.png`                                                                                                   | in-repo          |
| Legacy shard sprite                 | RPG-JS starter / legacy quest                         | MIT. Verify before submission.                                                                                                                                                                                                                                                                                                                                                                             | ~32px, scale 1             | Legacy 3-shard quest marker only; RETIRE with legacy quest        | `apps/game/public/spritesheets/shard.png`                                                                                                                | in-repo (legacy) |
| **GAP:** farm plot + crop tiles     | Kenney, kenney.nl (e.g. "Plant Pack" / "Farming")     | CC0                                                                                                                                                                                                                                                                                                                                                                                                        | Resize to 32x32, scale 1   | Tilled plot + crop growth stages (planted/watered/grown/ready)    | needs-sourcing                                                                                                                                           | needs-sourcing   |
| **GAP:** trees + wood               | Kenney, kenney.nl                                     | CC0                                                                                                                                                                                                                                                                                                                                                                                                        | Resize to 32x32, scale 1   | Tree resource node + stump (depleted)                             | needs-sourcing                                                                                                                                           | needs-sourcing   |
| **GAP:** mine / rock / crystal node | Kenney, kenney.nl                                     | CC0                                                                                                                                                                                                                                                                                                                                                                                                        | Resize to 32x32, scale 1   | Mine resource node + depleted state                               | needs-sourcing                                                                                                                                           | needs-sourcing   |
| **GAP:** tool + item icons          | Kenney, kenney.nl                                     | CC0                                                                                                                                                                                                                                                                                                                                                                                                        | 32x32 icon, scale 1        | Hoe/can/axe/pickaxe tools; crop/wood/stone/crystal item icons     | needs-sourcing                                                                                                                                           | needs-sourcing   |
| **GAP:** UI hotbar / HUD frame      | Kenney, kenney.nl                                     | CC0                                                                                                                                                                                                                                                                                                                                                                                                        | 32x32 slot, scale 1        | Hotbar slots, HUD panels, energy/currency frame                   | needs-sourcing                                                                                                                                           | needs-sourcing   |

License gate: this manifest is the contract format, but it is not fully approved yet. Rows with unverified licenses or `needs-sourcing` status are open items. Each implementing issue (#16-#18, #20) must resolve its rows — verified license, committed preview path, status updated — before the corresponding asset lands in the map.

## Target Layout Sketch

Approximate first-viewport layout on the current 25x20, 32px tile grid (`apps/game/src/tiled/simplemap.tmx`, orthogonal, Tiled 1.9.2). Each character is one tile. This sketch is canonical until committed `artifacts/frame-analysis/` contact sheets exist; those sheets are not in this repo today.

Legend: `.` walkable grass · `#` house/workshop (blocking) · `B` order board · `P` farm plot · `T` tree · `M` mine/rock · `D` house door (walkable, enters workstation scene) · `S` spawn.

```text
      x: 0123456789012345678901234
 y0   .........................
 y1   ..#####..............MMM.
 y2   ..#####..............MMM.
 y3   ..#####B.............M...
 y4   ..##D##..................
 y5   .........................
 y6   .....PPP........TT.......
 y7   .....PPP........TT.......
 y8   .........................
 y9   .........................
y10   .........................
y11   .........................
y12   .........................
y13   .........................
y14   .........................
y15   .........................
y16   .........................
y17   ..S......................
y18   .........................
y19   .........................
```

Approximate tile coordinates per element:

- Spawn `S` — tile (2, 17), layer `spawn`.
- House/workshop `#` — tiles (2,1) to (6,4) except the door tile, layer `collisions` (blocking); interior workstation enters a workstation scene.
- House door `D` — tile (4, 4), layer `workstations`, id `door_house`; walking onto it enters the workstation scene.
- Order board `B` — tile (7, 3), layer `workstations`, id `board_orders`.
- Farm plot cluster 3x2 `P` — tiles (5,6)(6,6)(7,6)(5,7)(6,7)(7,7), layer `farm_plots`, ids `plot_01`..`plot_06`.
- Tree cluster `T` — tiles (16,6)(17,6)(16,7)(17,7), layer `resource_nodes`, ids `tree_01`..`tree_04`.
- Mine/rock node `M` — tiles (21,1)(22,1)(23,1)(21,2)(22,2)(23,2)(21,3), layer `resource_nodes`, id `mine_01`.

## Tiled Object Grammar

Required object layers:

- `spawn`
- `collisions`
- `resource_nodes`
- `farm_plots`
- `workstations`
- `decor`

Required custom properties:

- `kind`: `plot | tree | mine | workstation | board | spawn | collision`
- `id`: stable unique id, e.g. `plot_01`, `tree_03`, `mine_01`, `board_orders`
- `resource`: `crop | wood | stone | crystal | none`
- `action`: `plant | water | harvest | chop | mine | fulfill | inspect | none`; `none` for non-interactable kinds (`spawn`, `collision`).
- `requiresTool`: `none | hoe | can | axe | pickaxe`
- `initialState`: `empty | planted | watered | grown | ready | depleted | active | none`; `none` for non-interactable kinds (`spawn`, `collision`).
- `rewardItem`: item id awarded by interaction; `none` if the object awards nothing.
- `orderId`: board order id (only `board` objects carry a non-`none` value; workstations reference orders through the board); `none` for all other objects.

Agent rule: if a map object lacks `kind` and stable `id`, gameplay code must not bind to it.

### Example objects

Tiled 1.9 exposes the object type as the `class` attribute (formerly `type`). Tiled 1.10+ writes this attribute as `type` again, so the map adapter must read both `class` and `type`; committed maps stay on Tiled 1.9.x until it does. Both examples below use the custom properties above.

`plot_01` on layer `farm_plots`:

```xml
<objectgroup name="farm_plots">
  <object name="plot_01" class="plot" x="160" y="192" width="32" height="32">
    <properties>
      <property name="kind" value="plot" />
      <property name="id" value="plot_01" />
      <property name="resource" value="crop" />
      <property name="action" value="plant" />
      <property name="requiresTool" value="hoe" />
      <property name="initialState" value="empty" />
      <property name="rewardItem" value="item_turnip" />
      <property name="orderId" value="none" />
    </properties>
  </object>
</objectgroup>
```

`board_orders` on layer `workstations`:

```xml
<objectgroup name="workstations">
  <object name="board_orders" class="board" x="224" y="96" width="32" height="32">
    <properties>
      <property name="kind" value="board" />
      <property name="id" value="board_orders" />
      <property name="resource" value="none" />
      <property name="action" value="fulfill" />
      <property name="requiresTool" value="none" />
      <property name="initialState" value="active" />
      <property name="rewardItem" value="none" />
      <property name="orderId" value="order_01" />
    </properties>
  </object>
</objectgroup>
```

### Collision and reachability rule

All solid and blocking geometry lives in the `collisions` object layer. Every interactable (`kind` plot/tree/mine/workstation/board) must have at least one orthogonally adjacent walkable tile so a player can reach and trigger it. No interactable may be fully enclosed by collision. Resource loop code must never place its own collision; it reads `collisions`.

### Stable ID rule

The Tiled object `name` field **is** the stable `id`. IDs are never renamed, never reused, never assigned by coordinates. Gameplay code, modules, tests, and screenshots bind to objects by `id` only. Editing an object's tile position is allowed; renaming an `id` is a breaking change that requires updating every consumer. The `id` custom property must always equal the object `name`; a mismatch is a validation failure and gameplay code must refuse to bind to the object.

## Module Contracts

Build small, testable modules:

- Resource loop module: owns plot/resource-node state transitions.
- Inventory module: owns item counts and mutations.
- Orders module: owns order definitions, fulfillment checks, and rewards.
- Map/object adapter: turns Tiled/RPG-JS objects into resource-loop objects.
- HUD adapter: displays state without owning game truth.
- Completion/proof bridge: exposes off-chain completion to the web/proof shell.

Do not put core game state only in DOM, HUD text, notification parsing, or claim-page local state.

### Path table

Module boundaries under `apps/game/src/modules/`:

| Path                     | Owns                                                                | Exposes                                               | Must not                                                                 |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `resourceLoop/index.ts`  | plot/node state machine (plant/water/harvest/chop/mine transitions) | `applyAction(nodeId, action)` -> `{ state, rewards }` | Touch inventory counts directly; render UI                               |
| `inventory/index.ts`     | item counts and mutations                                           | `addItem(itemId, n)`, `removeItem`, `count(itemId)`   | Know about map objects; emit proof                                       |
| `orders/index.ts`        | order definitions, fulfillment checks, rewards                      | `fulfill(orderId)`, `isFulfillable(orderId)`          | Own plot state; mutate inventory directly (go through the inventory API) |
| `adapters/mapObjects.ts` | Tiled/RPG-JS object -> resource-loop object mapping                 | `getById(id)`, `listByKind(kind)`                     | Mutate game truth; own state                                             |
| `adapters/hud.ts`        | display layer over RPG-JS scene                                     | `render(state)`, hotbar/HUD read API                  | Own counts/states; persist anything                                      |
| `proofBridge.ts`         | off-chain completion -> web/proof shell                             | `buildReceipt(completion)`, `isComplete()`            | Grant completion from claim-page local state alone                       |

### Reward flow

Successful `applyAction` calls (harvest/chop/mine) never mutate inventory. They return the new node state plus a `rewards` list of `{ itemId, qty }` grants. The RPG-JS event wiring in `apps/game/src/modules/main/` is the single caller that consumes this result and applies each grant via `inventory.addItem`. `orders.fulfill(orderId)` verifies with `isFulfillable`, removes payment items and adds reward items through the inventory API (never by touching counts directly), and returns a completion result that the same wiring layer forwards to `proofBridge`. Order definitions — order id, required payment items, and reward items, each as `{ itemId, qty }` — live in the orders module's own definition data, keyed by `orderId`; the map carries only the `orderId` reference on the board object. Dropping the `rewards` list or granting items from anywhere else violates module ownership.

### Legacy replacement note

`apps/game/src/modules/main/questLoop.ts` implements the old 3-shard quest and is still live today: `apps/game/src/modules/main/event.ts` imports `decideGuideAction`, `decideVillageNodeAction`, `QUEST_VARIABLES`, and `QuestSnapshot` from it, and `questLoop.test.ts` still exists. Under #16/#17 it is **replaced**, not extended, by `resourceLoop/` + `orders/`; only then are `questLoop.ts` and its test removed together with the legacy quest. Do not patch new resource-loop behavior onto it in the meantime.

## Definition Done Standard

Agent self-report is not enough. A task only passes when evidence exists:

- build/test command output for required repo scripts;
- screenshot or smoke artifact showing the real RPG-JS canvas;
- resource action evidence for farm/plot, tree/wood, and mine/rock/crystal where applicable;
- inventory/task/order state evidence;
- fulfillment/completion evidence;
- explicit note if canvas automation cannot prove an interaction, plus human keyboard smoke evidence.

## QA Gates

### Required local URLs

Smoke/agent harness targets (see `docs/AI_GAME_E2E.md`, `docs/AI_GAME_AGENT_WORKFLOW.md`):

- Deterministic smoke target: `http://127.0.0.1:4173/game/` (harness starts `vite preview` unless `AI_GAME_URL` is set).
- Web claim/proof shell: dev `http://localhost:5173/`.
- Game dev: `http://localhost:5174/`.

### Commands

```bash
# CI PR gate (deterministic)
npm ci
npm run build:vercel
npm run test:game:render
npm run test:game:ai

# Full autonomous VLM tester (vision endpoint required)
# base URL example lives in docs/AI_GAME_AGENT_WORKFLOW.md (tailnet-only endpoint)
AI_GAME_VLM_BASE_URL=<vision-endpoint-base-url> \
AI_GAME_VLM_MODEL=<vision-chat-model> \
AI_GAME_VLM_API_KEY="${AI_GAME_VLM_API_KEY:?set AI_GAME_VLM_API_KEY (any placeholder works for no-auth endpoints)}" \
npm run test:game:agent
```

Artifacts: `artifacts/ai-game-smoke/summary.md` + `report.json` + `step-*.png` (smoke); `artifacts/ai-game-agent/report.json` + `bugs.json` + `summary.md` + `screenshots/step-*.png` (agent).

### Pass / fail language per gate

- **First viewport.** PASS if a screenshot of the first frame shows house/workshop + farm plots + at least one resource node on the real RPG-JS canvas. FAIL if the viewport reads as only an NPC quest room or a blank/DOM scene.
- **Farm action.** PASS if pressing interact on a `farm_plots` object changes plot state (e.g. `empty` -> `planted`) and a screenshot shows the change. FAIL if no plot responds or the change only lives in HUD text.
- **Tree action.** PASS if interact on a `resource_nodes` tree awards `wood` and shows a depleted/stump state. FAIL if wood is granted without a visible node state change.
- **Mine action.** PASS if interact on a `resource_nodes` mine awards `stone`/`crystal` and shows depletion. FAIL if the mine is decorative-only.
- **Inventory / order progress.** PASS if counts and an open order both reflect the actions above (real module state, not a static label). FAIL if the counter or order list is hardcoded.
- **Fulfillment.** PASS if completing an order via `board_orders` emits completion feedback and updates `proofBridge`. FAIL if fulfillment cannot be triggered from the board.
- **No DOM fake.** PASS if every gate screenshot is the RPG-JS canvas, not a DOM/HTML mock. FAIL (hard gate) if any DOM layer replaces or hides the canvas.

### Automation limits

If canvas automation cannot press/interact reliably, record the limitation in the report and include human keyboard smoke screenshots for that gate. A direct page-load or `agent-browser open` is not interaction evidence.

## Agent Handoff Checklist

Before touching #16, #17, #18, or #20, answer all ten in your own notes:

1. Which asset pack/source is being used?
2. What license permits this usage?
3. What tile size and scale are used?
4. Which Tiled object layer contains farm plots?
5. Which Tiled object layer contains tree/resource nodes?
6. Which Tiled object layer contains the workstation/order board?
7. Which custom properties bind map objects to resource-loop code?
8. Which module owns inventory state?
9. Which module owns order fulfillment?
10. What screenshots prove the slice works?

If any answer is unknown, stop and complete #21 instead of guessing.

## What Not To Do

- Do not ask an agent to "make it like Pixels" without an asset manifest and object grammar.
- Do not let agents place random decorative tiles and call it game design.
- Do not let NPC dialogue be the main loop gate.
- Do not replace the RPG-JS canvas with a DOM mock.
- Do not switch to Phaser/Godot/custom canvas without a documented spike proving RPG-JS blocks the vertical slice.
- Do not mix random tilesets without documenting normalization.
- Do not let Firecrawl search noise become product requirements without human review.

## Stop Conditions

Stop and update #21 instead of coding when:

- asset source/license is unknown;
- tile size/scale is unknown;
- Tiled object grammar is missing;
- resource module ownership is unclear;
- QA screenshots cannot be produced;
- implementation starts reverting to NPC dialogue plus three pickups.
