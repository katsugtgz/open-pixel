// W2.2 TDD - pure state-machine transitions for the village resource loop.
//
// state.ts is pure TypeScript (no decorators, no @rpgjs imports) so the test
// bundles it with esbuild (consistent with items.test.mjs) and exercises the
// three pure functions: advancePlotState, transitionNodeState,
// pointsFromCompletion. These own the off-chain truth described in
// docs/agents/resource-village-deterministic-packet.md §5.
//
// Hackathon lifecycle (locked by W0.1 §5):
//   plot:  empty -> planted -> watered -> ready -> empty  (instant growth)
//   node:  ready -> depleted  (no regen for the hackathon slice)
//   points: plant=0, water=0, harvest=+5, chop=+3, mine=+4, fulfill=+25
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
const stateSrc = readFileSync(`${villageDir}state.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: stateSrc,
    sourcefile: "state.ts",
    resolveDir: villageDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  tsconfigRaw: { compilerOptions: { target: "ES2020" } },
});

const tmpDir = mkdtempSync(join(tmpdir(), "w22-state-"));
const modulePath = join(tmpDir, "state.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const {
  advancePlotState,
  transitionNodeState,
  pointsFromCompletion,
  addPoints,
  VILLAGE_POINTS_KEY,
} = await import(pathToFileURL(modulePath).href);

describe("W2.2 advancePlotState (empty -> planted -> watered -> ready -> empty)", () => {
  it("empty + plant -> planted", () => {
    assert.equal(advancePlotState("empty", "plant"), "planted");
  });

  it("planted + water -> watered", () => {
    assert.equal(advancePlotState("planted", "water"), "watered");
  });

  it("watered + harvest -> ready (crop finishes growing)", () => {
    assert.equal(advancePlotState("watered", "harvest"), "ready");
  });

  it("ready + harvest -> empty (crop picked, cycle restarts)", () => {
    assert.equal(advancePlotState("ready", "harvest"), "empty");
  });

  it("full cycle: empty -> planted -> watered -> ready -> empty", () => {
    let s = "empty";
    s = advancePlotState(s, "plant");
    s = advancePlotState(s, "water");
    s = advancePlotState(s, "harvest");
    s = advancePlotState(s, "harvest");
    assert.equal(s, "empty");
  });

  it("returns current unchanged on illegal action/state pairs (no-op)", () => {
    assert.equal(advancePlotState("empty", "water"), "empty");
    assert.equal(advancePlotState("empty", "harvest"), "empty");
    assert.equal(advancePlotState("planted", "plant"), "planted");
    assert.equal(advancePlotState("planted", "harvest"), "planted");
    assert.equal(advancePlotState("watered", "plant"), "watered");
    assert.equal(advancePlotState("watered", "water"), "watered");
    assert.equal(advancePlotState("ready", "plant"), "ready");
    assert.equal(advancePlotState("ready", "water"), "ready");
  });

  it("keeps depleted plots depleted", () => {
    assert.equal(advancePlotState("depleted", "plant"), "depleted");
    assert.equal(advancePlotState("depleted", "harvest"), "depleted");
  });
});

describe("W2.2 transitionNodeState (ready -> depleted, no regen)", () => {
  it("ready + chop -> depleted", () => {
    assert.equal(transitionNodeState("ready", "chop"), "depleted");
  });

  it("ready + mine -> depleted", () => {
    assert.equal(transitionNodeState("ready", "mine"), "depleted");
  });

  it("depleted stays depleted regardless of action (no hackathon regen)", () => {
    assert.equal(transitionNodeState("depleted", "chop"), "depleted");
    assert.equal(transitionNodeState("depleted", "mine"), "depleted");
  });

  it("returns current unchanged on mismatched action", () => {
    assert.equal(transitionNodeState("ready", "plant"), "ready");
  });
});

describe("W2.2 pointsFromCompletion (W0.1 §5 economy table)", () => {
  it("plant and water award 0 points", () => {
    assert.equal(pointsFromCompletion("plant"), 0);
    assert.equal(pointsFromCompletion("water"), 0);
  });

  it("harvest awards +5 points", () => {
    assert.equal(pointsFromCompletion("harvest"), 5);
  });

  it("chop awards +3 points per swing", () => {
    assert.equal(pointsFromCompletion("chop"), 3);
  });

  it("mine awards +4 points", () => {
    assert.equal(pointsFromCompletion("mine"), 4);
  });

  it("fulfill awards +25 points (default order value, exercised in W3.1)", () => {
    assert.equal(pointsFromCompletion("fulfill"), 25);
  });
});

describe("addPoints (shared accumulator)", () => {
  // W2.2 refactor - single source of truth for village_points. Wave 2 migrates
  // crop-plot/tree/mine/orders consumers to this helper; the structurally-typed
  // PointKeeper interface keeps state.ts pure (no @rpgjs imports).
  function makeKeeper() {
    return {
      _v: {},
      getVariable(k) {
        return this._v[k];
      },
      setVariable(k, v) {
        this._v[k] = v;
      },
    };
  }

  it("writes pts into VILLAGE_POINTS_KEY starting from 0 (undefined)", () => {
    const keeper = makeKeeper();
    addPoints(keeper, 5);
    assert.equal(keeper.getVariable(VILLAGE_POINTS_KEY), 5);
  });

  it("accumulates onto a previous addPoints result", () => {
    const keeper = makeKeeper();
    addPoints(keeper, 5);
    addPoints(keeper, 3);
    assert.equal(keeper.getVariable(VILLAGE_POINTS_KEY), 8);
  });

  it("accumulates onto a pre-existing village_points value", () => {
    const keeper = makeKeeper();
    keeper.setVariable(VILLAGE_POINTS_KEY, 10);
    addPoints(keeper, 5);
    assert.equal(keeper.getVariable(VILLAGE_POINTS_KEY), 15);
  });

  it("VILLAGE_POINTS_KEY is the canonical 'village_points' string", () => {
    assert.equal(VILLAGE_POINTS_KEY, "village_points");
  });
});
