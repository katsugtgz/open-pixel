import { type EventDefinition, RpgPlayer } from "@rpgjs/server";

const SHARDS = "open_pixel_shards";
const STARTED = "open_pixel_quest_started";
const DONE = "open_pixel_quest_done";

/**
 * Pick a random dialog variant from a readonly list of strings.
 *
 * Used to give the AI Guide (QuestGiver) small per-beat variety without
 * changing quest state, keys, points, or control flow. Downstream tasks
 * (Task 5 HUD, Task 11 Victory) rely on substrings embedded in these
 * variants:
 *   - `Progress: N/3` pattern in PRE_START / IN_PROGRESS variants.
 *   - Guest-badge / wallet-proof security copy in COMPLETE variants.
 *
 * Pure function: same input list, returns one of its entries at random.
 */
function pickVariant(variants: readonly string[]): string {
  return variants[Math.floor(Math.random() * variants.length)];
}

// --- AI Guide dialog variants ---------------------------------------------
// Each beat keeps the ORIGINAL text as the first variant (baseline preserved)
// and adds 2 alternates. The Progress: N/3 pattern and security-promise copy
// are preserved across variants per AGENTS.md anti-patterns.

const QUEST_PRE_START_VARIANTS: readonly string[] = [
  "AI Quest: gather 3 glowing cyan Pixel Shards. Press Space near each shard. Progress: ${shards}/3",
  "Welcome, traveler! The AI Guide needs 3 cyan Pixel Shards. Press Space near each one to collect. Progress: ${shards}/3",
  "The island's shards have scattered. Gather 3 glowing cyan Pixel Shards, then return to me. Progress: ${shards}/3",
];

const QUEST_IN_PROGRESS_VARIANTS: readonly string[] = [
  "AI Quest: still gathering 3 glowing cyan Pixel Shards. Press Space near each shard. Progress: ${shards}/3",
  "Welcome back, traveler. ${shards}/3 Pixel Shards so far. Keep searching the island for the cyan glow. Progress: ${shards}/3",
  "Good progress! ${shards}/3 shards collected. The remaining shards are nearby. Progress: ${shards}/3",
];

const QUEST_COMPLETE_VARIANTS: readonly string[] = [
  "Quest complete! +100 off-chain points. Go back to the web page and claim your badge.",
  "Quest complete! All 3 Pixel Shards delivered, 130 off-chain points total. Return to the web page to claim your guest badge or optional wallet proof.",
  "Victory, traveler! 130 off-chain points earned (3 shards + turn-in). Return to the web page to claim your guest badge or optional wallet proof.",
];

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
        // Task 11 — Victory moment. `Quest complete` + `130` are load-bearing:
        // the test asserts /Quest complete/ here, and the victory overlay IIFE
        // in index.html matches /complete/i + /130/ on notification text.
        await player.showNotification(
          "★ Quest complete! 130 points · Claim your guest badge on the web page ★",
          { sound: "quest-complete", type: "info" },
        );
        await player.showText(
          pickVariant(QUEST_COMPLETE_VARIANTS).replaceAll(
            "${shards}",
            String(shards),
          ),
        );
        return;
      }
      // PRE-START (STARTED was false) vs IN-PROGRESS (STARTED already true).
      // Capture prior state BEFORE setting it so we can pick the right beat.
      const wasStarted = !!player.getVariable<boolean>(STARTED);
      player.setVariable(STARTED, true);
      const shardStr = String(shards);
      const variants = wasStarted
        ? QUEST_IN_PROGRESS_VARIANTS
        : QUEST_PRE_START_VARIANTS;
      await player.showText(
        pickVariant(variants).replaceAll("${shards}", shardStr),
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
      // `· N/3` suffix is load-bearing: the objective HUD IIFE in index.html
      // matches it via /[·•]\s*(\d+)\s*\/\s*3/ to fire the pickup scale-bump.
      await player.showNotification(
        `✨ Pixel Shard collected · ${Math.min(next, 3)}/3`,
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
