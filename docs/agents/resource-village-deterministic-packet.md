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

## Asset Manifest Required

Before map or gameplay implementation, document:

- source URL/path;
- license;
- intended use: terrain, farm plots, trees, mine/resource node, workshop/house, UI, item icons;
- tile size and sprite scale;
- pixel-art rendering rule;
- normalization rule for mixed styles;
- preview screenshot/thumb path.

No random tileset mixing without explicit normalization.

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
- `action`: `plant | water | harvest | chop | mine | fulfill | inspect`
- `requiresTool`: `none | hoe | can | axe | pickaxe`
- `initialState`: `empty | planted | watered | grown | ready | depleted | active`
- `rewardItem`: item id awarded by interaction
- `orderId`: workstation or board order id

Agent rule: if a map object lacks `kind` and stable `id`, gameplay code must not bind to it.

## Module Contracts

Build small, testable modules:

- Resource loop module: owns plot/resource-node state transitions.
- Inventory module: owns item counts and mutations.
- Orders module: owns order definitions, fulfillment checks, and rewards.
- Map/object adapter: turns Tiled/RPG-JS objects into resource-loop objects.
- HUD adapter: displays state without owning game truth.
- Completion/proof bridge: exposes off-chain completion to the web/proof shell.

Do not put core game state only in DOM, HUD text, notification parsing, or claim-page local state.

## Definition Done Standard

Agent self-report is not enough. A task only passes when evidence exists:

- build/test command output for required repo scripts;
- screenshot or smoke artifact showing the real RPG-JS canvas;
- resource action evidence for farm/plot, tree/wood, and mine/rock/crystal where applicable;
- inventory/task/order state evidence;
- fulfillment/completion evidence;
- explicit note if canvas automation cannot prove an interaction, plus human keyboard smoke evidence.

## QA Gates

Required screenshots or equivalent artifacts:

- first viewport: farm/resource hub visible;
- farm action feedback;
- tree/resource action feedback;
- mine/resource action feedback;
- inventory/order progress;
- fulfillment/completion;
- no DOM fake game replacing RPG-JS scene.

If canvas automation cannot press/interact reliably, record the limitation and include human keyboard smoke result screenshots.

## Stop Conditions

Stop and update #21 instead of coding when:

- asset source/license is unknown;
- tile size/scale is unknown;
- Tiled object grammar is missing;
- resource module ownership is unclear;
- QA screenshots cannot be produced;
- implementation starts reverting to NPC dialogue plus three pickups.
