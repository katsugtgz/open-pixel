// W3.1 - HUD adapter: read-only projection of village player state.
//
// renderHud derives a HudModel from the player's live inventory + points
// variable. It owns NO game truth - it is a pure view over inventory.ts and
// orders.ts.
//
// Model definition only — not currently wired into runtime. Live HUD updates
// flow directly from `emitCompletion` socket events to the DOM via
// apps/game/index.html. renderHud is kept as a future-API stub for when a
// richer controls/HUD model is needed (e.g. an in-engine Vue/CanvasEngine HUD
// component consuming this shape).
//
// Per W0.1 §6 the HUD must surface resources + points (Appendix A: the single
// "gems" pill is deferred). controls stays a static string list so the smoke
// harness can assert the village loop verbs are advertised; renderHud returns
// a defensive copy so callers cannot mutate the shared module-level list.
import type { RpgPlayer } from "@rpgjs/server";
import { createInventory, type InventoryShape } from "./inventory";
import { VILLAGE_ORDERS } from "./orders";
import { VILLAGE_POINTS_KEY } from "./state";

export interface HudModel {
  resources: InventoryShape;
  points: number;
  currentOrderLabel: string | null;
  controls: string[];
}

/** Static controls list shared with the W2.2 `.quest-hint` div. */
const VILLAGE_CONTROLS: readonly string[] = [
  "Move: WASD / Arrow keys",
  "Action: Space",
  "Plant · Water · Harvest crops, Chop trees, Mine rocks",
  "Fulfill orders at the Task Board",
];

/**
 * Project the player's village state into a HUD model. The first order in the
 * catalogue is advertised as the current order (the board_orders workstation
 * binds to order_01); this keeps the HUD's order label in sync with the order
 * board's default without coupling the HUD to Tiled properties.
 */
export function renderHud(player: RpgPlayer): HudModel {
  const inventory = createInventory(player);
  const points = player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0;
  const currentOrderLabel =
    VILLAGE_ORDERS.length > 0 ? VILLAGE_ORDERS[0].label : null;
  return {
    resources: inventory.snapshot(),
    points,
    currentOrderLabel,
    controls: [...VILLAGE_CONTROLS],
  };
}
