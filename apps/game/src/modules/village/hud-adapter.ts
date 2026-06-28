// W1.3 stub — implementation lands in W3.1.
import type { RpgPlayer } from "@rpgjs/server";
import type { InventoryShape } from "./inventory";

export interface HudModel {
  resources: InventoryShape;
  points: number;
  currentOrderLabel: string | null;
  controls: string[]; // ['Move: Arrows/WASD', 'Action: Space', ...]
}

export function renderHud(player: RpgPlayer): HudModel {
  throw new Error("W1.3 stub: renderHud");
}
