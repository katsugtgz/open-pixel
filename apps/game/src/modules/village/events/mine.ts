// W2.2 - Mine event factory (resource_nodes layer, kind=mine).
//
// Mining is a single-hit resource for the hackathon slice: one swing depletes
// the rock and yields one Ochrux Matrix (+4 points, free). The depletion flag
// lives on the player so the node stays depleted for the demo session. No
// regen during the vertical slice (W0.1 §5).
//
// Invisible hitbox: the rock visuals are tile art placed in W2.1.
import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import { addPoints, pointsFromCompletion } from "../state";
import { emitCompletion } from "../proof-bridge";

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
      const pts = pointsFromCompletion("mine");
      player.addItem(rewardItem, 1);
      addPoints(player, pts);
      emitCompletion(player);
      await player.showNotification(`Mined ${rewardItem} · +1 · +${pts} pts`, {
        sound: "collect",
        type: "info",
      });
    },
  };
}
