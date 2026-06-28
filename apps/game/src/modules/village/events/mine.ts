// W2.2 - Mine event factory (resource_nodes layer, kind=mine).
//
// Mining is a single-hit resource for the hackathon slice: one swing depletes
// the rock and yields one Ochrux Matrix (+4 points, free). The depletion flag
// lives on the player so the node stays depleted for the demo session. No
// regen during the vertical slice (W0.1 §5).
//
// Invisible hitbox: the rock visuals are tile art placed in W2.1.
import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import { pointsFromCompletion } from "../state";
import { VILLAGE_POINTS_KEY } from "./crop-plot";

function addPoints(player: RpgPlayer, pts: number): void {
  const current = player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0;
  player.setVariable(VILLAGE_POINTS_KEY, current + pts);
}

export interface MineNodeProps {
  id: string;
  rewardItem?: string;
}

export function MineFactory(props: MineNodeProps): EventDefinition {
  const mineId = props.id;
  const rewardItem = props.rewardItem ?? "ochrux_matrix";
  const depletedKey = `mine_depleted_${mineId}`;
  return {
    name: mineId,
    async onAction(player: RpgPlayer) {
      if (player.getVariable<boolean>(depletedKey)) {
        await player.showText("This rock is depleted.");
        return;
      }
      player.setVariable(depletedKey, true);
      player.addItem(rewardItem, 1);
      const pts = pointsFromCompletion("mine");
      addPoints(player, pts);
      await player.showNotification(`Mined Ochrux Matrix · +1 · +${pts} pts`, {
        sound: "collect",
        type: "info",
      });
    },
  };
}
