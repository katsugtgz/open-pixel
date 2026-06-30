# GAME APP KNOWLEDGE BASE

## OVERVIEW

RPG-JS/Vite game demo: village map, CropPlot/Tree/Mine/OrderBoard events, local save, audio cues.

## STRUCTURE

```text
apps/game/
|-- src/modules/village/ # resource-village loop: CropPlot, Tree, Mine, OrderBoard
|-- src/modules/main/    # legacy module shell retained for RPG-JS boot
|-- src/tiled/          # Tiled maps + generated tileset TSX + PNG assets
|-- src/config/         # RPG-JS client/server config
|-- public/audio/       # gather and completion sounds
`-- public/spritesheets/# hero/NPC sprites
```

## WHERE TO LOOK

| Task                  | Location                                     | Notes                                       |
| --------------------- | -------------------------------------------- | ------------------------------------------- |
| Village event logic   | `src/modules/village/events/`                | CropPlot, Tree, Mine, OrderBoard factories. |
| Map wiring/adapter    | `src/modules/village/map-adapter.ts`         | Binds village object layers to events.      |
| Player spawn/graphic  | `src/modules/main/player.ts`                 | Starts on `village`; graphic is `hero`.     |
| Game server providers | `src/server.ts`                              | Tiled map + local save strategy.            |
| Client boot           | `src/client.ts`                              | `startGame(mergeConfig(...))`.              |
| Map source            | `src/tiled/village.tmx`, `src/tiled/map.tmx` | Tiled-authored village map.                 |

## CODE MAP

| Symbol               | Location                      | Role                                                        |
| -------------------- | ----------------------------- | ----------------------------------------------------------- |
| `CropPlotFactory`    | `src/modules/village/events/` | Plant/water/harvest Popberry cycle, updates `plot_state_*`. |
| `TreeFactory`        | `src/modules/village/events/` | Chop for Whittlewood Log, tracks `tree_hits_*`.             |
| `MineFactory`        | `src/modules/village/events/` | Mine rocks for Ochrux Matrix, tracks `mine_depleted_*`.     |
| `OrderBoardFactory`  | `src/modules/village/events/` | Fulfill village orders, awards `village_points`.            |
| `player.onConnected` | `src/modules/main/player.ts`  | Spawns player and sets display name/graphic.                |
| `player.onInput`     | `src/modules/main/player.ts`  | Opens main menu on `"escape"`.                              |
| default module       | `src/modules/village/`        | Binds village events to map via adapter.                    |
| default server       | `src/server.ts`               | Wires RPG-JS providers.                                     |

## CONVENTIONS

- Hand-edit `src/modules/village/*` for resource-loop gameplay; treat `src/tiled/*_pipo.tsx` as generated/asset-adjacent.
- Resource-loop progress is tracked with player variables (`plot_state_*`, `tree_hits_*`, `mine_depleted_*`, `village_points`), not Supabase or wallet state.
- Points mirror web copy: off-chain `village_points` accrued from harvesting crops, chopping trees, mining rocks, and fulfilling orders.
- Audio names used in notifications must exist in `public/audio`.
- `build` is Vite-only; package `typecheck` currently echoes through Vite build.

## ANTI-PATTERNS

- Do not couple RPG-JS gameplay to wallet connection.
- Do not turn resource gathering into token minting or chain writes.
- Do not manually reformat generated tileset exports; diffs become huge and low-signal.
- Do not change village state variable keys casually; existing local saves use them.

## COMMANDS

```bash
npm run dev -w @open-pixel/game
npm run build -w @open-pixel/game
npm run typecheck -w @open-pixel/game
```
