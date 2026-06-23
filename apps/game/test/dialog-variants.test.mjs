// Unit tests for QuestGiver dialog variants in apps/game/src/modules/main/event.ts (Task 8).
//
// `pickVariant` and the three `QUEST_*_VARIANTS` arrays are module-private
// (NOT exported). Rather than modify event.ts to export them, these tests
// exercise pickVariant INDIRECTLY through the exported `QuestGiver()` event
// factory. A mock RpgPlayer captures every showText/showNotification call,
// and a deterministic Math.random stub forces pickVariant to return each
// variant index in turn — so every variant string is verified exactly once,
// with zero flakiness (no statistical "run it 500 times" gambits).
//
// Runs under Node's built-in `node:test`. Node >= 22.6 strips TypeScript
// annotations on import, so the REAL event.ts source is tested directly —
// no build, no transpiler dep.
//
// Invoke via: `node --test test/` (or `npm run test -w @open-pixel/game`).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QuestGiver } from "../src/modules/main/event.ts";

// Quest variable keys (mirrors event.ts constants; locked here so renaming
// a key without updating the dialog flow becomes a visible test failure).
const SHARDS = "open_pixel_shards";
const STARTED = "open_pixel_quest_started";
const DONE = "open_pixel_quest_done";

// Minimal mock of RpgPlayer — only the surface QuestGiver.onAction touches.
function createMockPlayer(vars = {}) {
  const variables = { ...vars };
  return {
    variables,
    texts: [],
    notifications: [],
    gold: 0,
    getVariable(key) {
      return variables[key];
    },
    setVariable(key, value) {
      variables[key] = value;
    },
    async showText(text) {
      this.texts.push(text);
    },
    async showNotification(msg, opts) {
      this.notifications.push({ msg, opts });
    },
  };
}

// Run `fn` with Math.random forced to return `ratio`, then restore it.
// pickVariant does `Math.floor(Math.random() * variants.length)`; with 3
// variants, ratio = idx/3 yields floor(idx) = idx — deterministic selection.
// MUST be async + `await fn()` so the stub stays in place across ALL awaits
// inside fn (the COMPLETE beat calls pickVariant AFTER `await showNotification`,
// so a synchronous finally would restore Math.random too early).
async function withRandom(ratio, fn) {
  const original = Math.random;
  Math.random = () => ratio;
  try {
    return await fn();
  } finally {
    Math.random = original;
  }
}

describe("QuestGiver — event factory shape", () => {
  it("returns an object with onInit and onAction functions", () => {
    const event = QuestGiver();
    assert.equal(typeof event.onInit, "function");
    assert.equal(typeof event.onAction, "function");
  });

  it("onInit calls this.setGraphic('female')", () => {
    const event = QuestGiver();
    let graphic = null;
    event.onInit.call({ setGraphic(g) { graphic = g; } });
    assert.equal(graphic, "female");
  });
});

describe("QuestGiver PRE-START beat — all 3 variants contain 'Progress: 0/3'", () => {
  // PRE-START = first talk: STARTED was false, shards=0.
  // Each variant has exactly ONE ${shards} token, so .replace fully resolves.
  const variants = [];
  for (let idx = 0; idx < 3; idx++) {
    it(`variant [${idx}] resolves ${"${shards}"} and contains 'Progress: 0/3'`, async () => {
      const player = createMockPlayer();
      const text = await withRandom(idx / 3, async () => {
        await QuestGiver().onAction(player);
        return player.texts[0];
      });
      variants.push(text);

      assert.equal(player.texts.length, 1, "exactly one showText call");
      assert.match(
        text,
        /Progress: 0\/3/,
        `PRE-START variant [${idx}] must contain 'Progress: 0/3', got: ${text}`,
      );
      // No unresolved template tokens allowed in PRE-START.
      assert.ok(
        !text.includes("${shards}"),
        `PRE-START variant [${idx}] must not leave \${shards} unresolved: ${text}`,
      );
      // State transition: STARTED gets set on first talk.
      assert.equal(player.variables[STARTED], true);
    });
  }

  it("all 3 PRE-START variants are distinct (locks variant count)", () => {
    assert.equal(
      new Set(variants).size,
      3,
      "Expected exactly 3 distinct PRE-START variants",
    );
  });
});

describe("QuestGiver IN-PROGRESS beat — all 3 variants fully resolve and contain 'Progress: 1/3'", () => {
  // IN-PROGRESS = returning talk: STARTED already true, shards < 3 (using 1).
  // Variant[0] has one ${shards}; variants [1] and [2] each have TWO
  // ${shards} tokens. event.ts uses String.replaceAll (not String.replace),
  // so EVERY occurrence is substituted — the resulting text always contains
  // 'Progress: 1/3' and never contains a literal '${shards}' substring.
  // (Earlier String.replace form only substituted the first occurrence; that
  // bug was fixed and these assertions now lock the corrected behavior.)

  const variants = [];
  for (let idx = 0; idx < 3; idx++) {
    it(`variant [${idx}] fully resolves ${"${shards}"} and contains 'Progress: 1/3'`, async () => {
      const player = createMockPlayer({
        [STARTED]: true,
        [SHARDS]: 1,
      });
      const text = await withRandom(idx / 3, async () => {
        await QuestGiver().onAction(player);
        return player.texts[0];
      });
      variants.push(text);

      assert.equal(player.texts.length, 1, "exactly one showText call");
      assert.match(
        text,
        /Progress: 1\/3/,
        `IN-PROGRESS variant [${idx}] must contain 'Progress: 1/3', got: ${text}`,
      );
      // No unresolved template tokens allowed — replaceAll must substitute all.
      assert.ok(
        !text.includes("${shards}"),
        `IN-PROGRESS variant [${idx}] must not leave \${shards} unresolved: ${text}`,
      );
    });
  }

  it("all 3 IN-PROGRESS variants are distinct (locks variant count)", () => {
    assert.equal(
      new Set(variants).size,
      3,
      "Expected exactly 3 distinct IN-PROGRESS variants",
    );
  });

  it("IN-PROGRESS beat does NOT alter shard count or mark DONE", async () => {
    const player = createMockPlayer({ [STARTED]: true, [SHARDS]: 1 });
    await withRandom(0, async () => {
      await QuestGiver().onAction(player);
    });
    assert.equal(player.variables[SHARDS], 1, "shard count must not change");
    assert.notEqual(player.variables[DONE], true, "must not mark DONE");
    assert.equal(player.gold, 0, "must not grant gold");
  });
});

describe("QuestGiver COMPLETE beat — turn-in (shards >= 3)", () => {
  const variants = [];
  for (let idx = 0; idx < 3; idx++) {
    it(`variant [${idx}] grants +100 gold, sets DONE, fires notification + complete text`, async () => {
      const player = createMockPlayer({
        [STARTED]: true,
        [SHARDS]: 3,
      });
      const text = await withRandom(idx / 3, async () => {
        await QuestGiver().onAction(player);
        return player.texts[0];
      });
      variants.push(text);

      // State + reward mutations (must be identical across variants).
      assert.equal(player.variables[DONE], true, "DONE must be set");
      assert.equal(player.gold, 100, "+100 gold granted");

      // Notification unchanged across variants.
      assert.equal(player.notifications.length, 1, "one notification");
      assert.match(player.notifications[0].msg, /Quest complete/);
      assert.deepEqual(player.notifications[0].opts, {
        sound: "quest-complete",
        type: "info",
      });

      // Complete text must reference completion and points.
      assert.ok(
        /Quest complete|Victory/.test(text),
        `COMPLETE variant [${idx}] must announce completion: ${text}`,
      );
      assert.ok(
        /\b100\b|\b130\b/.test(text),
        `COMPLETE variant [${idx}] must reference points (100 or 130): ${text}`,
      );
    });
  }

  it("all 3 COMPLETE variants are distinct (locks variant count)", () => {
    assert.equal(new Set(variants).size, 3);
  });

  it("at least one COMPLETE variant mentions wallet proof / guest badge (security copy)", () => {
    // 2 of 3 COMPLETE variants must carry the security promise copy.
    const withCopy = variants.filter(
      (t) => /wallet proof|guest badge/i.test(t),
    );
    assert.ok(
      withCopy.length >= 2,
      `Expected >=2 COMPLETE variants to mention guest badge/wallet proof, got ${withCopy.length}`,
    );
  });
});

describe("QuestGiver POST-DONE beat — returns early", () => {
  it("shows 'Run complete' text and does not re-reward", async () => {
    const player = createMockPlayer({
      [STARTED]: true,
      [SHARDS]: 3,
      [DONE]: true,
    });
    await QuestGiver().onAction(player);

    assert.equal(player.texts.length, 1);
    assert.match(player.texts[0], /Run complete/);
    assert.equal(player.gold, 0, "no additional gold");
    assert.equal(player.notifications.length, 0, "no notification");
  });
});

describe("pickVariant distribution — deterministic coverage", () => {
  // Confirms pickVariant selects each index when Math.random is pinned, i.e.
  // the helper is `variants[Math.floor(Math.random() * variants.length)]`.
  it(" Math.random = idx/3 selects variant idx exactly (3-variant array)", async () => {
    const seen = new Set();
    for (let idx = 0; idx < 3; idx++) {
      const player = createMockPlayer(); // PRE-START
      await withRandom(idx / 3, async () => {
        await QuestGiver().onAction(player);
      });
      seen.add(player.texts[0]);
    }
    assert.equal(seen.size, 3, "each pinned random value must yield a distinct variant");
  });
});
