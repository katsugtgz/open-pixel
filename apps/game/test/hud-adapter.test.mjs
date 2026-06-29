// W3.x TDD - renderHud pure projection over village player state.
//
// hud-adapter.ts imports inventory.ts (relative), orders.ts (relative),
// state.ts (relative) plus a type-only RpgPlayer from @rpgjs/server, so esbuild
// can bundle it into pure ESM (the type import is erased) and we exercise
// renderHud against a lightweight mock player. The mock mirrors the verified
// RPG-JS v5 runtime semantics used by orders.test.mjs:
//   - getItem(id) returns undefined when the item is missing (runtime only;
//     the TS signature is non-undefined, but the impl returns items()[index]).
//   - Item.quantity() is the signal read returning the stack count.
//   - hasItem(id) is !!getItem(id).
//   - getVariable/setVariable back onto a plain object.
//
// Behavior is asserted through the public surface (renderHud return shape) so
// the tests survive internal refactors. Per the W3.x decision, renderHud is a
// model-only projection: not currently wired into the runtime, but kept as a
// tested pure function for future Vue/CanvasEngine HUD work.
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
const hudSrc = readFileSync(`${villageDir}hud-adapter.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: hudSrc,
    sourcefile: "hud-adapter.ts",
    resolveDir: villageDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  tsconfigRaw: { compilerOptions: { target: "ES2020" } },
});

const tmpDir = mkdtempSync(join(tmpdir(), "w3x-hud-"));
const modulePath = join(tmpDir, "hud-adapter.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const { renderHud } = await import(pathToFileURL(modulePath).href);

/**
 * Minimal RpgPlayer double exposing only the item + variable surface the
 * village inventory + HUD code touches. `getItem` returns undefined for
 * missing/empty stacks exactly like the real ItemManager.
 */
function makePlayer(initial = {}, points = 0) {
  const items = { ...initial };
  const vars = { village_points: points };
  return {
    items,
    vars,
    hasItem(id) {
      return (items[id] ?? 0) > 0;
    },
    getItem(id) {
      const qty = items[id] ?? 0;
      if (qty <= 0) return undefined;
      return { quantity: () => qty };
    },
    addItem(id, n) {
      items[id] = (items[id] ?? 0) + n;
    },
    removeItem(id, n) {
      items[id] = Math.max(0, (items[id] ?? 0) - n);
    },
    getVariable(key) {
      return vars[key];
    },
    setVariable(key, val) {
      vars[key] = val;
    },
  };
}

describe("W3.x renderHud (pure projection)", () => {
  it("projects village_points from the player variable", () => {
    const player = makePlayer({}, 42);
    const model = renderHud(player);
    assert.equal(model.points, 42);
  });

  it("defaults points to 0 when the variable is unset", () => {
    const player = makePlayer({}, undefined);
    const model = renderHud(player);
    assert.equal(model.points, 0);
  });

  it("advertises the first catalogue order as the current order label", () => {
    const player = makePlayer({}, 0);
    const model = renderHud(player);
    assert.ok(
      typeof model.currentOrderLabel === "string" &&
        model.currentOrderLabel.length > 0,
      "currentOrderLabel should mirror VILLAGE_ORDERS[0].label",
    );
  });

  it("returns a fresh controls array per call (no shared mutation)", () => {
    const player = makePlayer({}, 5);
    const model1 = renderHud(player);
    // Mutate the returned array; if renderHud shares VILLAGE_CONTROLS by
    // reference this leak must surface on the next call.
    model1.controls.push("INJECTED");
    const model2 = renderHud(player);
    assert.ok(
      !model2.controls.includes("INJECTED"),
      "renderHud must return a fresh controls array each call",
    );
    assert.notEqual(
      model1.controls,
      model2.controls,
      "controls arrays must be distinct references",
    );
  });
});
