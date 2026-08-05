// W2.2 TDD - Mine event factory onAction sanity lock.
//
// mine.ts imports type-only symbols from @rpgjs/server and pure helpers from
// ../state. This test locks the post-Wave-1 consolidation behavior: mining a
// fresh rock yields +1 rewardItem and awards +4 village_points via the shared
// addPoints helper. No behavior bug is being fixed here - the test guards
// against future regressions in the addPoints wiring (signature, key name,
// accumulator semantics).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { URL, fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const villageDir = fileURLToPath(
  new URL("../src/modules/village/", import.meta.url),
);
const eventsDir = `${villageDir}events/`;
const mineSrc = readFileSync(`${eventsDir}mine.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: mineSrc,
    sourcefile: "mine.ts",
    resolveDir: eventsDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  external: ["@rpgjs/*"],
  tsconfigRaw: { compilerOptions: { target: "ES2020" } },
});

const tmpDir = mkdtempSync(join(tmpdir(), "w22-mine-"));
const modulePath = join(tmpDir, "mine.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const { MineFactory } = await import(pathToFileURL(modulePath).href);

const VILLAGE_POINTS_KEY = "village_points";

function makePlayer(initialVars = {}) {
  const items = [];
  const notifications = [];
  const texts = [];
  const emits = [];
  const vars = { ...initialVars };
  return {
    items,
    notifications,
    texts,
    emits,
    vars,
    addItem(id, n) {
      items.push([id, n]);
    },
    getVariable(key) {
      return vars[key];
    },
    setVariable(key, val) {
      vars[key] = val;
    },
    hasItem() {
      return false;
    },
    emit(type, value) {
      emits.push([type, value]);
    },
    async showNotification(msg, opts) {
      notifications.push({ msg, opts });
    },
    async showText(msg) {
      texts.push(msg);
    },
  };
}

describe("W2.2 MineFactory onAction sanity (addPoints consolidation lock)", () => {
  it("default mine yields +1 ochrux_matrix and +4 village_points on first action", async () => {
    const player = makePlayer();
    const event = MineFactory({ id: "m1" });
    await event.onAction(player);

    assert.ok(
      player.items.some(([id, n]) => id === "ochrux_matrix" && n === 1),
      `addItem must be called with ["ochrux_matrix", 1]; got ${JSON.stringify(player.items)}`,
    );
    const pts = player.getVariable(VILLAGE_POINTS_KEY);
    assert.ok(pts > 0, `village_points must be > 0 after mining; got ${pts}`);
    assert.equal(
      pts,
      4,
      "mine must award exactly pointsFromCompletion('mine') === 4",
    );
    assert.equal(
      player.getVariable("mine_depleted_m1"),
      true,
      "mine must mark itself depleted after the first swing (hackathon slice, no regen)",
    );
  });

  it("honors custom rewardItem prop", async () => {
    const player = makePlayer();
    const event = MineFactory({ id: "m2", rewardItem: "crystal_shard" });
    await event.onAction(player);

    assert.ok(
      player.items.some(([id, n]) => id === "crystal_shard" && n === 1),
      `addItem must use prop rewardItem; got ${JSON.stringify(player.items)}`,
    );
  });

  it("second action on depleted mine does not re-reward", async () => {
    const player = makePlayer({ mine_depleted_m3: true });
    const event = MineFactory({ id: "m3" });
    await event.onAction(player);

    assert.equal(
      player.items.length,
      0,
      "depleted mine must not yield items on subsequent actions",
    );
    assert.equal(
      player.getVariable(VILLAGE_POINTS_KEY),
      undefined,
      "depleted mine must not award additional points",
    );
  });

  it("emits village:complete inventory snapshot after mining", async () => {
    const player = makePlayer();
    const event = MineFactory({ id: "m4" });
    await event.onAction(player);

    const villageEmit = player.emits.find(
      ([type]) => type === "village:complete",
    );
    assert.ok(
      villageEmit,
      "mining a rock must emit 'village:complete' so the HUD/socket bridge updates live counts",
    );
    const payload = villageEmit[1];
    assert.ok(
      payload && typeof payload.resources === "object",
      "emit payload must carry resources snapshot for the HUD",
    );
  });
});
