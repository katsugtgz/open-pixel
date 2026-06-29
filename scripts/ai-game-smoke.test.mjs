import { test } from "node:test";
import assert from "node:assert/strict";
import { RESOURCE_SIGNAL, evaluateRun } from "./ai-game-smoke.mjs";

// Regex contract: "could not fulfill" must NOT count as fulfillment signal
// (prior false-positive). "Order fulfilled" / "Reward:" must.
test("RESOURCE_SIGNAL.order regex: no false-positive on 'could not fulfill'", () => {
  assert.equal(RESOURCE_SIGNAL.order.test("could not fulfill order"), false);
});

test("RESOURCE_SIGNAL.order regex: matches real fulfillment signals", () => {
  assert.equal(RESOURCE_SIGNAL.order.test("Order fulfilled! Reward: 10"), true);
});

// evaluateRun pure gate: movement alone no longer passes when strict (default).
test("evaluateRun: movement-only fails strict resource gate", () => {
  const result = evaluateRun({
    uniqueHashes: 5,
    uniquePositions: 5,
    resourceActionsDetected: 0,
    hitCategories: [],
    observedText: "",
  });
  assert.equal(result.passed, false);
  assert.match(result.reason, /resource-loop not verified/);
});

test("evaluateRun: >=2 resource categories passes", () => {
  const result = evaluateRun({
    uniqueHashes: 5,
    uniquePositions: 5,
    resourceActionsDetected: 2,
    hitCategories: ["crop", "tree"],
    observedText: "",
  });
  assert.equal(result.passed, true);
});
