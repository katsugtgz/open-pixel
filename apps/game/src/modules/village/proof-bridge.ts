// W3.1 - Proof bridge: projects village completion to the game client socket.
//
// emitCompletion snapshots the player's resources + points and emits a
// `village:complete` event over the RPG-JS v5 player socket
// (player.emit(type, value) - verified in
// node_modules/@rpgjs/server/dist/Player/Player.d.ts). It also logs the payload
// so the demo can observe completion without a wired client listener.
//
// CROSS-APP BRIDGE LIMITATION (hackathon scope, documented):
//   The web claim app (apps/web) runs on a separate Vite origin/port from the
//   game (apps/game). `player.emit` only reaches sockets inside the game's own
//   RPG-JS client/server connection, so the web claim page does NOT receive
//   `village:complete` in real time. The actual game -> web state sync for the
//   hackathon slice happens through the W1.2 Supabase upsert in the web claim
//   flow (apps/web/src/App.tsx::saveGuestClaim), which writes the QuestRun
//   resources/points. A real-time bridge (shared socket, postMessage across the
//   game iframe, or an HTTP endpoint) is a production TODO and intentionally
//   out of scope per the W3.1 brief ("Do not over-engineer the real-time
//   bridge for the hackathon").
//
// Payload shape: `resources` is the full InventoryShape (live truth, superset
// of QuestRunResources). The W1.2 claim flow maps popberry / whittlewood_log /
// ochrux_matrix into the QuestRun.resources field; popberry_seeds rides along
// as extra context and is ignored by the proof message.
import type { RpgPlayer } from "@rpgjs/server";
import { createInventory, type InventoryShape } from "./inventory";
import { VILLAGE_POINTS_KEY } from "./orders";

export interface VillageCompletionPayload {
  resources: InventoryShape;
  points: number;
  completedAt: number;
}

/**
 * Snapshot the player's village progress and emit it on the game socket. Safe
 * to call on every fulfillment; idempotent and side-effect-free beyond the emit
 * + log. Returns the payload so callers (tests, future wiring) can inspect it.
 */
export function emitCompletion(player: RpgPlayer): VillageCompletionPayload {
  const inventory = createInventory(player);
  const payload: VillageCompletionPayload = {
    resources: inventory.snapshot(),
    points: player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0,
    completedAt: Date.now(),
  };
  // In-game client socket emit (harmless when no listener is bound). The web
  // claim page listens for Supabase rows instead - see file header.
  player.emit("village:complete", payload);
  // eslint-disable-next-line no-console
  console.log("[village] completion emitted", payload);
  return payload;
}
