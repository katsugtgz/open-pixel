# Resource-Village Deterministic Packet

This packet is the handoff contract for implementing the Cozy Resource-Village Loop.
Agents must read this before implementing gameplay issues #16, #17, #18, or #20.

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

Before map or interaction work starts, define:

- Source URL or local source path.
- License.
- Tile size and intended scale.
- Terrain set.
- Farm plot set.
- Tree or wood resource set.
- Mine, rock, crystal, or equivalent resource set.
- Workshop or house set.
- Item icons.
- UI/HUD elements.
- Preview image path for each group.
- Normalization rule for mixed styles.

No random tileset mixing without explicit normalization.

## Tiled Object Grammar

Object layers:

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
- `action`: `plant | water | harvest | chop | mine | fulfill | inspect`
- `requiresTool`: `none | hoe | can | axe | pickaxe`
- `initialState`: `empty | planted | watered | grown | ready | depleted | active`
- `rewardItem`: item id awarded by interaction
- `orderId`: workstation or board order id

Agent rule: if a map object lacks `kind` and stable `id`, gameplay code must not
bind to it.

## Module Contracts

Build deep modules with small interfaces:

- Resource loop module: owns plot/resource-node state transitions.
- Inventory module: owns item counts and item mutations.
- Orders module: owns order definitions, fulfillment checks, and rewards.
- Map/object adapter: turns Tiled/RPG-JS objects into resource-loop objects.
- HUD adapter: displays state without owning game truth.
- Completion/proof bridge: exposes off-chain completion to the web/proof shell.

Do not put core game state only in DOM, HUD text, or notification parsing.

## QA Gates

Required screenshots:

- First viewport: farm/resource hub visible.
- Farm action feedback.
- Tree/resource action feedback.
- Mine/resource action feedback.
- Inventory/order state.
- Fulfillment/completion state.

Required behavior checks:

- Player moves in RPG-JS canvas.
- Player can progress without talking to an NPC first.
- At least two direct resource actions work.
- Inventory/resource count changes after actions.
- One order can be fulfilled.
- Completion feedback is visible.
- No DOM fake game replaces the RPG-JS scene.

If canvas automation cannot press/interact reliably, record the limitation and
include a human keyboard smoke result with screenshots.

## Stop Conditions

Stop and update #21 instead of coding when:

- Asset source/license is unknown.
- Tile size/scale is unknown.
- Tiled object grammar is missing.
- Resource module ownership is unclear.
- QA screenshots cannot be produced.
- The implementation starts reverting to NPC dialogue plus three pickups.
