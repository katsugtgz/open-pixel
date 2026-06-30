import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import {
  decideGuideAction,
  decideVillageNodeAction,
  QUEST_VARIABLES,
  type QuestSnapshot,
} from "./questLoop";

function snapshotQuest(player: RpgPlayer, nodeKey?: string): QuestSnapshot {
  return {
    started: Boolean(player.getVariable<boolean>(QUEST_VARIABLES.started)),
    done: Boolean(player.getVariable<boolean>(QUEST_VARIABLES.done)),
    nodesRestored:
      player.getVariable<number>(QUEST_VARIABLES.nodesRestored) || 0,
    nodeCollected: nodeKey
      ? Boolean(player.getVariable<boolean>(nodeKey))
      : undefined,
  };
}

function collectionKey(eventId: string): string {
  return `open_pixel_collected_${eventId}`;
}

export function QuestGiver(): EventDefinition {
  return {
    onInit() {
      this.setGraphic("female");
    },
    async onAction(player: RpgPlayer) {
      const decision = decideGuideAction(snapshotQuest(player));

      if (decision.kind === "complete") {
        player.setVariable(QUEST_VARIABLES.done, decision.setDone);
        player.gold += decision.rewardPoints;
        await player.showNotification(decision.notification.message, {
          sound: decision.notification.sound,
          type: decision.notification.type,
        });
        await player.showText(decision.text);
        return;
      }

      if (decision.kind === "start-or-progress") {
        player.setVariable(QUEST_VARIABLES.started, decision.setStarted);
      }

      await player.showText(decision.text);
    },
  };
}

export function PixelShard(): EventDefinition {
  return {
    onInit() {
      this.setGraphic("shard");
    },
    async onAction(player: RpgPlayer) {
      const nodeKey = collectionKey(this.id);
      const decision = decideVillageNodeAction(snapshotQuest(player, nodeKey));

      if (decision.kind === "restore-node") {
        player.setVariable(nodeKey, decision.markCollected);
        player.setVariable(
          QUEST_VARIABLES.nodesRestored,
          decision.nodesRestored,
        );
        player.gold += decision.rewardPoints;
        await player.showNotification(decision.notification.message, {
          sound: decision.notification.sound,
          type: decision.notification.type,
        });
      }

      await player.showText(decision.text);
    },
  };
}
