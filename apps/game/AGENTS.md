# Game App Knowledge Base

## Current Product Direction

RPG-JS/Vite game target: **Cozy Resource-Village Loop**. The player should understand and perform resource actions directly in the world: farm, chop, mine, craft or prepare, track inventory/task progress, fulfill one board/workstation request, then receive a Game Completion Receipt.

Legacy/current implementation still contains AI Guide + three village nodes/Pixel Shards. Treat that as implementation debt unless explicitly patching current shipped behavior.

## Structure

```text
apps/game/
|-- src/modules/main/ # hand-written game/player/module logic
|-- src/tiled/        # Tiled maps + generated tileset TSX + PNG assets
|-- src/config/       # RPG-JS client/server config + smoke contract
|-- public/audio/     # collect and completion sounds
`-- public/spritesheets/ # hero/NPC/resource sprites
```

## Where To Look

| Task                            | Location                                                        | Notes                                               |
| ------------------------------- | --------------------------------------------------------------- | --------------------------------------------------- |
| Current legacy quest text/state | `src/modules/main/event.ts`, `src/modules/main/questLoop.ts`    | Existing AI Guide + node flow; not target loop.     |
| Map/event placement             | `src/modules/main/server.ts`, `src/modules/main/layoutRoles.ts` | Coordinates on `simplemap`.                         |
| Player spawn/graphic            | `src/modules/main/player.ts`                                    | Starts on `simplemap`; graphic is `hero`.           |
| Game server providers           | `src/server.ts`                                                 | Tiled map + local save strategy.                    |
| Client boot                     | `src/client.ts`                                                 | `startGame(mergeConfig(...))`.                      |
| Target pipeline                 | `docs/agents/resource-village-deterministic-packet.md`          | Asset/Tiled/module/QA contract before #16-#18 work. |

## Product Rules

- Do not make AI Guide dialogue the main loop gate.
- Do not treat three shards/nodes as product-complete resource gameplay.
- Resource progress must start without wallet and without talking to an NPC first.
- Preserve RPG-JS canvas; no DOM mock game, fake overlay, hidden canvas, or replacement movement layer.
- Do not manually reformat generated tileset exports; diffs become huge and low-signal.
- Do not change existing quest variable keys casually; old local saves may depend on them.

## Definition Done

Game work is not done from prose alone. Required evidence:

- `npm run build:vercel`
- `npm run test:game:render`
- `npm run test:game:ai`
- Screenshots or smoke artifacts showing resource action, inventory/task progress, and fulfillment/completion.
- If automation cannot prove a canvas interaction, record the limitation and include a human keyboard smoke result.

## Commands

```bash
npm run dev -w @open-pixel/game
npm run build -w @open-pixel/game
npm run typecheck -w @open-pixel/game
```
