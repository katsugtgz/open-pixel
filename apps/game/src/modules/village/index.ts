// W2.2 - Village module provider.
//
// Registers the village map with its Tiled-object-derived events plus the player
// hooks (shared with the legacy main module via ../main/player).
//
// RPG-JS v5 binding note (W2.2 discovery): the module-level `map: { onLoad }`
// global hook, the per-map `MapOptions.onLoad`, and `player.onJoinMap` do not
// fire reliably in v5.0.0-beta.1 dev for this module, so the runtime
// `registerMapObjects(map)` adapter cannot be the primary event-binding path.
// Instead, the `VILLAGE_EVENTS` static array (map-adapter.ts:165-232) supplies
// hand-inlined event coordinates that mirror apps/game/src/tiled/village.tmx
// (frozen at W2.1); no @canvasengine/tiled module-load parse is involved.
// RPG-JS creates each entry through `map.createDynamicEvent` during updateMap -
// the same mechanism the legacy simplemap module used. The runtime
// `registerMapObjects` adapter is still exported (idempotent, composes safely)
// for the module contract and production paths where map hooks fire. See
// map-adapter.ts and docs/agents/resource-village-deterministic-packet.md §3.1.
import { defineModule } from "@rpgjs/common";
import { type RpgServer } from "@rpgjs/server";
import { player as mainPlayer } from "../main/player";
import { VILLAGE_EVENTS, VILLAGE_HITBOXES } from "./map-adapter";

// W2.2 binding note (RPG-JS v5 deviation): the module-level `map: { onLoad }`
// global hook and the per-map `MapOptions.onLoad` do not fire reliably in
// v5.0.0-beta.1 dev, so the runtime `registerMapObjects(map)` adapter cannot be
// the primary event-binding path. Instead the village MapOptions carries a
// static `events` array (VILLAGE_EVENTS, derived from village.tmx); RPG-JS
// creates each entry through `map.createDynamicEvent` during updateMap - the
// same mechanism the legacy simplemap module used. registerMapObjects is still
// exported (idempotent) for the W0.1 §3.1 contract and production paths where
// map hooks fire. See map-adapter.ts.
export const villageServer = defineModule<RpgServer>({
  player: mainPlayer,
  maps: [
    {
      id: "village",
      events: VILLAGE_EVENTS,
      hitboxes: VILLAGE_HITBOXES,
    },
  ],
});

// API-compatibility wrapper for the provideVillage contract; server.ts composes
// villageServer inside provideServerModules so its hooks/database register.
export function provideVillage() {
  return villageServer;
}

// Re-exports for convenient imports from elsewhere:
export * from "./state";
export * from "./inventory";
export * from "./orders";
export * from "./map-adapter";
export * from "./hud-adapter";
export * from "./proof-bridge";
export * from "./items";
// Explicit named re-exports (not `export *`) to avoid VILLAGE_POINTS_KEY
// collision with ./state, which is the canonical source.
export {
  CropPlotFactory,
  TreeFactory,
  TREE_HITS_TO_FELL,
  MineFactory,
  OrderBoardFactory,
} from "./events";
export type {
  CropPlotProps,
  TreeNodeProps,
  MineNodeProps,
  OrderBoardProps,
} from "./events";
