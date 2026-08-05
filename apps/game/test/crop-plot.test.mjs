// W2.2 TDD - CropPlot event factory onAction (harvest reward path).
//
// crop-plot.ts imports only type-only symbols from @rpgjs/server and pure
// helpers from ../state, so esbuild can bundle it into pure ESM. We exercise
// the onAction hook with a lightweight mock player and assert the harvest
// payout (reward item + village_points) lands through the public surface.
//
// Behavior locked:
//   - Pressing Space on a plot whose current state is "grown" must harvest:
//     +1 rewardItem and +5 village_points (pointsFromCompletion("harvest")).
//   - "grown" is the forward-compatible plot state kept in the union; the
//     hackathon slice collapses watered -> ready but external/pre-fetched
//     plots can still arrive as "grown" and the harvest path must fire.
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
const cropPlotSrc = readFileSync(`${eventsDir}crop-plot.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: cropPlotSrc,
    sourcefile: "crop-plot.ts",
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

const tmpDir = mkdtempSync(join(tmpdir(), "w22-crop-plot-"));
const modulePath = join(tmpDir, "crop-plot.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const { CropPlotFactory } = await import(pathToFileURL(modulePath).href);

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

describe("W2.2 CropPlotFactory onAction harvest payout", () => {
  it("rewards +1 rewardItem and +5 points when current plot state is 'grown'", async () => {
    const player = makePlayer({ plot_state_p1: "grown" });
    const event = CropPlotFactory({ id: "p1" });
    await event.onAction(player);

    assert.ok(
      player.items.some(([id, n]) => id === "popberry" && n === 1),
      `addItem must be called with ["popberry", 1]; got ${JSON.stringify(player.items)}`,
    );
    const pts = player.getVariable(VILLAGE_POINTS_KEY);
    assert.ok(
      pts > 0,
      `village_points must be > 0 after grown-state harvest; got ${pts}`,
    );
    assert.equal(
      pts,
      5,
      "grown-state harvest must award exactly pointsFromCompletion('harvest') === 5",
    );
  });

  it("rewards custom rewardItem when provided via props", async () => {
    const player = makePlayer({ plot_state_p2: "grown" });
    const event = CropPlotFactory({ id: "p2", rewardItem: "glowberry" });
    await event.onAction(player);

    assert.ok(
      player.items.some(([id, n]) => id === "glowberry" && n === 1),
      `addItem must use prop rewardItem; got ${JSON.stringify(player.items)}`,
    );
  });

  it("advances plot_state to 'empty' after harvesting a 'grown' plot", async () => {
    const player = makePlayer({ plot_state_p3: "grown" });
    const event = CropPlotFactory({ id: "p3" });
    await event.onAction(player);

    assert.equal(
      player.getVariable("plot_state_p3"),
      "empty",
      "grown plot must cycle back to empty after harvest",
    );
  });

  it("emits village:complete inventory snapshot after harvest", async () => {
    const player = makePlayer({ plot_state_p4: "grown" });
    const event = CropPlotFactory({ id: "p4" });
    await event.onAction(player);

    const villageEmit = player.emits.find(
      ([type]) => type === "village:complete",
    );
    assert.ok(
      villageEmit,
      "harvest must emit 'village:complete' so the HUD/socket bridge updates live counts",
    );
    const payload = villageEmit[1];
    assert.ok(
      payload && typeof payload.resources === "object",
      "emit payload must carry resources snapshot for the HUD",
    );
  });
});
