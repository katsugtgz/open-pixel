// W2.2 - Tree event factory (resource_nodes layer, kind=tree).
//
// Trees are a multi-hit resource: the player chops 3 times before the tree
// falls and drops a Whittlewood Log. The hit counter and depletion flag live on
// the player as variables so they persist for the demo session. Per W0.1 §5,
// each swing awards +3 points and the action is free; depleted trees do not
// regen during the hackathon slice.
//
// As with the crop plot, this is an invisible hitbox: the tree visuals are tile
// art placed in W2.1, and `setGraphic` is intentionally not called.
import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import { pointsFromCompletion } from "../state";
import { VILLAGE_POINTS_KEY } from "./crop-plot";

/** Number of chop swings required to fell a tree (hackathon tuning). */
export const TREE_HITS_TO_FELL = 3;

function addPoints(player: RpgPlayer, pts: number): void {
  const current = player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0;
  player.setVariable(VILLAGE_POINTS_KEY, current + pts);
}

export interface TreeNodeProps {
  id: string;
  rewardItem?: string;
  hitsToFell?: number;
}

export function TreeFactory(props: TreeNodeProps): EventDefinition {
  const treeId = props.id;
  const rewardItem = props.rewardItem ?? "whittlewood_log";
  const hitsToFell = props.hitsToFell ?? TREE_HITS_TO_FELL;
  const hitsKey = `tree_hits_${treeId}`;
  const depletedKey = `tree_depleted_${treeId}`;
  return {
    name: treeId,
    async onAction(player: RpgPlayer) {
      if (player.getVariable<boolean>(depletedKey)) {
        await player.showText("This tree has already been chopped down.");
        return;
      }
      const hits = (player.getVariable<number>(hitsKey) ?? 0) + 1;
      player.setVariable(hitsKey, hits);
      const pts = pointsFromCompletion("chop");
      addPoints(player, pts);

      if (hits >= hitsToFell) {
        player.setVariable(depletedKey, true);
        player.addItem(rewardItem, 1);
        await player.showNotification(
          `Tree felled · +1 Whittlewood Log · +${pts} pts`,
          { sound: "collect", type: "info" },
        );
        return;
      }
      await player.showNotification(`Chop! ${hits}/${hitsToFell}`, {
        type: "info",
      });
    },
  };
}
