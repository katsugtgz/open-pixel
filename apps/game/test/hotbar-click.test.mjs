import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = readFileSync(
  join(__dirname, "..", "index.html"),
  "utf8",
);

// Tests for hotbar click → select behavior added in m0248 item #4.
// Pattern: assert HTML structure + verify pure logic of the select helper.

test("index.html wires pointer-events:auto on .slot so clicks reach slots", () => {
  // Parent .village-hud is pointer-events:none (HUD floats over canvas);
  // .slot must override to receive clicks.
  const slotRule = INDEX_HTML.match(/\.village-hud \.slot \{[^}]+\}/);
  assert.ok(slotRule, ".village-hud .slot CSS rule must exist");
  assert.match(slotRule[0], /pointer-events:\s*auto/);
  assert.match(slotRule[0], /cursor:\s*pointer/);
});

test("index.html defines selectHotbarSlot handler with toggle semantics", () => {
  assert.match(INDEX_HTML, /function\s+selectHotbarSlot\s*\(/);
  assert.match(INDEX_HTML, /function\s+wireHotbarClicks\s*\(/);
  // Toggle: clicking active slot removes .active.
  assert.match(INDEX_HTML, /wasActive/);
  assert.match(INDEX_HTML, /classList\.remove\("active"\)/);
  assert.match(INDEX_HTML, /classList\.add\("active"\)/);
});

test("index.html dispatches village:select-item CustomEvent on click", () => {
  assert.match(
    INDEX_HTML,
    /new CustomEvent\("village:select-item"/,
  );
  // Must read data-item attribute (item id or null for tools).
  assert.match(INDEX_HTML, /getAttribute\("data-item"\)/);
});

test("wireHotbarClicks is idempotent (dataset.wired guard)", () => {
  assert.match(INDEX_HTML, /dataset\.wired\s*===\s*"1"/);
  assert.match(INDEX_HTML, /hud\.dataset\.wired\s*=\s*"1"/);
});

// Pure-logic mirror of the selectHotbarSlot toggle behavior. The inline
// handler in index.html is the production code; this asserts the algorithm.
function pureSelectSlot(slotsState, clickedIndex) {
  // slotsState: array of {item, active} objects.
  // clickedIndex: number
  // Returns {slots: newState, selectedItem: item|null}
  if (
    !Array.isArray(slotsState) ||
    clickedIndex < 0 ||
    clickedIndex >= slotsState.length
  ) {
    return { slots: slotsState, selectedItem: null };
  }
  const wasActive = slotsState[clickedIndex].active;
  const cleared = slotsState.map((s) => ({ ...s, active: false }));
  if (wasActive) {
    return { slots: cleared, selectedItem: null };
  }
  cleared[clickedIndex].active = true;
  return { slots: cleared, selectedItem: cleared[clickedIndex].item };
}

test("pureSelectSlot: clicking inactive slot marks it active, clears siblings", () => {
  const initial = [
    { item: "popberry_seeds", active: false },
    { item: "popberry", active: true }, // currently active
    { item: "whittlewood_log", active: false },
  ];
  const { slots, selectedItem } = pureSelectSlot(initial, 2);
  assert.equal(slots[0].active, false);
  assert.equal(slots[1].active, false); // sibling cleared
  assert.equal(slots[2].active, true);
  assert.equal(selectedItem, "whittlewood_log");
});

test("pureSelectSlot: clicking active slot deselects (toggle off)", () => {
  const initial = [
    { item: "popberry", active: true },
    { item: "wood", active: false },
  ];
  const { slots, selectedItem } = pureSelectSlot(initial, 0);
  assert.equal(slots[0].active, false);
  assert.equal(selectedItem, null);
});

test("pureSelectSlot: clicking slot with null item (e.g. Axe tool) dispatches null", () => {
  const initial = [
    { item: null, active: false }, // Axe slot has no data-item
    { item: "popberry", active: false },
  ];
  const { slots, selectedItem } = pureSelectSlot(initial, 0);
  assert.equal(slots[0].active, true);
  assert.equal(selectedItem, null);
});
