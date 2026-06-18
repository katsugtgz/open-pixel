import { type EventDefinition, RpgPlayer } from "@rpgjs/server";

const SHARDS = "open_pixel_shards";
const STARTED = "open_pixel_quest_started";
const DONE = "open_pixel_quest_done";

export function QuestGiver(): EventDefinition {
  return {
    onInit() {
      this.setGraphic("female");
    },
    async onAction(player: RpgPlayer) {
      const shards = player.getVariable<number>(SHARDS) || 0;
      if (player.getVariable<boolean>(DONE)) {
        await player.showText(
          "You already proved your gather run. Your wallet-proof badge is ready.",
        );
        return;
      }
      if (shards >= 3) {
        player.setVariable(DONE, true);
        player.gold += 100;
        await player.showNotification("Quest complete · +100 points", {
          sound: "quest-complete",
          type: "info",
        });
        await player.showText(
          "Quest complete! +100 off-chain points. Claim mock unlocked.",
        );
        return;
      }
      player.setVariable(STARTED, true);
      await player.showText(
        `AI Quest: gather 3 Pixel Shards from the field. Progress: ${shards}/3`,
      );
    },
  };
}

export function PixelShard(): EventDefinition {
  return {
    onInit() {
      this.setGraphic("female");
    },
    async onAction(player: RpgPlayer) {
      if (!player.getVariable<boolean>(STARTED)) {
        await player.showText("A glowing shard. Talk to the AI Guide first.");
        return;
      }
      if (player.getVariable<boolean>(DONE)) {
        await player.showText("You already completed this quest.");
        return;
      }
      const next = (player.getVariable<number>(SHARDS) || 0) + 1;
      player.setVariable(SHARDS, Math.min(next, 3));
      player.gold += 10;
      await player.showNotification("Pixel Shard collected · +10", {
        sound: "collect",
        type: "info",
      });
      await player.showText(
        `Pixel Shard collected. Progress: ${Math.min(next, 3)}/3. +10 points.`,
      );
    },
  };
}
