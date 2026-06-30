// W2.2 TDD - Tree event factory onAction (felled notification labels).
//
// tree.ts imports type-only symbols from @rpgjs/server and pure helpers from
// ../state, so esbuild bundles it into pure ESM. We exercise onAction with a
// mock player and assert the felled notification surfaces the prop rewardItem
// rather than a hardcoded label. The hackathon default is whittlewood_log, but
// resource_nodes layer can override rewardItem per-instance via Tiled props, so
// the label must track the prop.
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
const treeSrc = readFileSync(`${eventsDir}tree.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: treeSrc,
    sourcefile: "tree.ts",
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

const tmpDir = mkdtempSync(join(tmpdir(), "w22-tree-"));
const modulePath = join(tmpDir, "tree.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const { TreeFactory } = await import(pathToFileURL(modulePath).href);

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

describe("W2.2 TreeFactory onAction felled notification uses prop rewardItem", () => {
  it("ironwood_log reward surfaces in the felled notification, not 'Whittlewood Log'", async () => {
    const player = makePlayer();
    const event = TreeFactory({
      id: "t1",
      rewardItem: "ironwood_log",
      hitsToFell: 1,
    });
    await event.onAction(player);

    assert.ok(
      player.notifications.length > 0,
      "a felled notification must fire when hits reaches hitsToFell",
    );
    const arg = player.notifications[0].msg;
    assert.ok(
      arg.includes("ironwood_log"),
      `notification must include prop rewardItem 'ironwood_log'; got ${JSON.stringify(arg)}`,
    );
    assert.ok(
      !arg.includes("Whittlewood Log"),
      `notification must NOT hardcode 'Whittlewood Log' when rewardItem differs; got ${JSON.stringify(arg)}`,
    );
    assert.ok(
      player.items.some(([id, n]) => id === "ironwood_log" && n === 1),
      `addItem must use prop rewardItem; got ${JSON.stringify(player.items)}`,
    );
    const pts = player.getVariable(VILLAGE_POINTS_KEY);
    assert.ok(pts > 0, `chop must award points; got ${pts}`);
  });

  it("default rewardItem keeps whittlewood_log in the felled label", async () => {
    const player = makePlayer();
    const event = TreeFactory({ id: "t2", hitsToFell: 1 });
    await event.onAction(player);

    const arg = player.notifications[0].msg;
    assert.ok(
      arg.includes("whittlewood_log"),
      `default tree must surface 'whittlewood_log' in the label; got ${JSON.stringify(arg)}`,
    );
  });

  it("emits village:complete inventory snapshot after felling", async () => {
    const player = makePlayer();
    const event = TreeFactory({ id: "t3", hitsToFell: 1 });
    await event.onAction(player);

    const villageEmit = player.emits.find(
      ([type]) => type === "village:complete",
    );
    assert.ok(
      villageEmit,
      "felling a tree must emit 'village:complete' so the HUD/socket bridge updates live counts",
    );
    const payload = villageEmit[1];
    assert.ok(
      payload && typeof payload.resources === "object",
      "emit payload must carry resources snapshot for the HUD",
    );
  });
});
