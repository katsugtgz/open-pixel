// W1.3 stub — implementation lands in W3.1.
import type { RpgPlayer } from "@rpgjs/server";
import type { InventoryShape } from "./inventory";

export interface VillageCompletionPayload {
  resources: InventoryShape;
  points: number;
  completedAt: number;
}

export function emitCompletion(player: RpgPlayer): void {
  throw new Error("W1.3 stub: emitCompletion");
}
