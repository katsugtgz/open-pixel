# GAME APP KNOWLEDGE BASE

## OVERVIEW

RPG-JS/Vite game demo: simple map, AI Guide NPC, three Pixel Shards, local save, audio cues.

## STRUCTURE

```text
apps/game/
|-- src/modules/main/   # hand-written quest/player/module logic
|-- src/tiled/          # Tiled maps + generated tileset TSX + PNG assets
|-- src/config/         # RPG-JS client/server config
|-- public/audio/       # collect and completion sounds
`-- public/spritesheets/# hero/NPC sprites
```

## WHERE TO LOOK

| Task                  | Location                                       | Notes                                     |
| --------------------- | ---------------------------------------------- | ----------------------------------------- |
| Quest text/state      | `src/modules/main/event.ts`                    | `STARTED`, `SHARDS`, `DONE` variables.    |
| NPC/shard placement   | `src/modules/main/server.ts`                   | Coordinates on `simplemap`.               |
| Player spawn/graphic  | `src/modules/main/player.ts`                   | Starts on `simplemap`; graphic is `hero`. |
| Game server providers | `src/server.ts`                                | Tiled map + local save strategy.          |
| Client boot           | `src/client.ts`                                | `startGame(mergeConfig(...))`.            |
| Map source            | `src/tiled/simplemap.tmx`, `src/tiled/map.tmx` | Tiled-authored maps.                      |

## CODE MAP

| Symbol               | Location                     | Role                                                      |
| -------------------- | ---------------------------- | --------------------------------------------------------- |
| `QuestGiver`         | `src/modules/main/event.ts`  | Starts quest, checks 3 shards, grants +100.               |
| `PixelShard`         | `src/modules/main/event.ts`  | Requires quest start, increments shard count, grants +10. |
| `player.onConnected` | `src/modules/main/player.ts` | Spawns player and sets display name/graphic.              |
| `player.onInput`     | `src/modules/main/player.ts` | Opens main menu on `back`.                                |
| default module       | `src/modules/main/server.ts` | Binds events to map.                                      |
| default server       | `src/server.ts`              | Wires RPG-JS providers.                                   |

## CONVENTIONS

- Hand-edit `src/modules/main/*` for gameplay; treat `src/tiled/*_pipo.tsx` as generated/asset-adjacent.
- Quest completion is tracked with player variables, not Supabase or wallet state.
- Points mirror web copy: three shards at +10 each, completion at +100, total 130.
- Audio names used in notifications must exist in `public/audio`.
- `build` is Vite-only; package `typecheck` currently echoes through Vite build.

## ANTI-PATTERNS

- Do not couple RPG-JS gameplay to wallet connection.
- Do not turn shard collection into token minting or chain writes.
- Do not manually reformat generated tileset exports; diffs become huge and low-signal.
- Do not change quest variable keys casually; existing local saves use them.

## COMMANDS

```bash
npm run dev -w @open-pixel/game
npm run build -w @open-pixel/game
npm run typecheck -w @open-pixel/game
```
