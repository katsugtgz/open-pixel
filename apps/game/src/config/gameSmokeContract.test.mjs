import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  GAME_SMOKE_CONTRACT,
  getGamePreviewUrl,
  isGameAssetUrl,
  matchesQuestProgress,
} from "./gameSmokeContract.js";

describe("game smoke contract", () => {
  it("publishes smoke-visible selectors and preview defaults", () => {
    assert.equal(GAME_SMOKE_CONTRACT.canvasSelector, "#rpg canvas");
    assert.equal(GAME_SMOKE_CONTRACT.dialogSelector, ".rpg-ui-dialog-body");
    assert.equal(GAME_SMOKE_CONTRACT.hudSelector, ".quest-hint");
    assert.equal(getGamePreviewUrl(), "http://127.0.0.1:4173/game/");
  });

  it("exposes the AI Guide onAction target and range used by the smoke pass gate", () => {
    // Must match apps/game/src/modules/main/layoutRoles.ts MAP_ROLES.aiGuide.
    assert.deepEqual(GAME_SMOKE_CONTRACT.quest.guidePosition, {
      x: 384,
      y: 352,
    });
    assert.ok(
      GAME_SMOKE_CONTRACT.quest.interactionRange > 0 &&
        GAME_SMOKE_CONTRACT.quest.interactionRange <= 64,
      "interactionRange must be a sane adjacency radius in pixels (0, 64]",
    );
  });

  it("lists dialog phrases that only appear in real showText() output, never the HUD", () => {
    const phrases = GAME_SMOKE_CONTRACT.quest.dialogPhrases;
    assert.ok(Array.isArray(phrases) && phrases.length >= 3);
    // The static HUD hint must NOT match any real-dialog phrase, otherwise
    // the pass gate could be spoofed without any onAction actually firing.
    const hud = "Talk to AI Guide \u2192 restore 3 village nodes.";
    for (const phrase of phrases) {
      assert.equal(
        hud.toLowerCase().includes(phrase.toLowerCase()),
        false,
        `HUD hint must not contain dialog phrase "${phrase}"`,
      );
    }
    // A real guide showText() body (from questLoop.ts decideGuideAction)
    // MUST match at least one phrase.
    const realDialog =
      "Village restoration: activate 3 village nodes. Press Space near a glowing node. Off-chain progress: 0/3";
    assert.ok(
      phrases.some((p) => realDialog.toLowerCase().includes(p.toLowerCase())),
      "real guide showText() body must match at least one dialogPhrase",
    );
  });

  it("matches built game assets used by render and smoke checks", () => {
    assert.equal(
      isGameAssetUrl("http://127.0.0.1:4173/game/map/simplemap.json"),
      true,
    );
    assert.equal(
      isGameAssetUrl("http://127.0.0.1:4173/game/spritesheets/hero.png"),
      true,
    );
    assert.equal(
      isGameAssetUrl("http://127.0.0.1:4173/game/audio/collect.wav"),
      true,
    );
    assert.equal(
      isGameAssetUrl("http://127.0.0.1:4173/game/default-bundle.json"),
      true,
    );
    assert.equal(isGameAssetUrl("http://127.0.0.1:4173/favicon.ico"), false);
  });

  it("matches quest progress language surfaced to the smoke runner", () => {
    assert.equal(matchesQuestProgress("2/3 village nodes collected"), true);
    assert.equal(
      matchesQuestProgress("Quest complete. Guest badge earned."),
      true,
    );
    assert.equal(matchesQuestProgress("Walk with arrow keys."), false);
  });
});
