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
          "Run complete. Return to the web page to claim your guest badge or optional wallet proof.",
        );
        return;
      }
      if (shards >= 3) {
        player.setVariable(DONE, true);
        player.gold += 100;
        player.emit("open_pixel:quest_run", {
          id: `run_${String(player.id).slice(-8)}`,
          guestId: String(player.id),
          displayName: typeof player.name === "string" ? player.name : "Guest",
          questId: "Quest #1 — Gather Pixel Shards",
          points: 130,
          shards: 3,
          completedAt: new Date().toISOString(),
        });
        await player.showNotification("Quest complete · +100 points", {
          sound: "quest-complete",
          type: "info",
        });
        await player.showText(
          "Quest complete! +100 off-chain points. Go back to the web page and claim your badge.",
        );
        return;
      }
      player.setVariable(STARTED, true);
      await player.showText(
        `AI Quest: gather 3 glowing cyan Pixel Shards. Press Space near each shard. Progress: ${shards}/3`,
      );
    },
  };
}

export function PixelShard(): EventDefinition {
  return {
    onInit() {
      this.setGraphic("shard");
    },
    async onAction(player: RpgPlayer) {
      const shardKey = `open_pixel_collected_${this.id}`;
      if (!player.getVariable<boolean>(STARTED)) {
        await player.showText(
          "A glowing Pixel Shard. Talk to the AI Guide first, then return here.",
        );
        return;
      }
      if (player.getVariable<boolean>(DONE)) {
        await player.showText("You already completed this quest.");
        return;
      }
      if (player.getVariable<boolean>(shardKey)) {
        await player.showText("This Pixel Shard is already collected.");
        return;
      }
      const next = (player.getVariable<number>(SHARDS) || 0) + 1;
      player.setVariable(shardKey, true);
      player.setVariable(SHARDS, Math.min(next, 3));
      player.gold += 10;
      await player.showNotification(
        `Pixel Shard collected · ${Math.min(next, 3)}/3`,
        {
          sound: "collect",
          type: "info",
        },
      );
      await player.showText(
        `Pixel Shard collected. Progress: ${Math.min(next, 3)}/3. +10 points.`,
      );
    },
  };
}
