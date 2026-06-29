import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { selectHotbarSlot } from "../src/modules/village/hotbar-selection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, "..", "index.html"),
  "utf8",
);

function slot(item, active = false) {
  let pressed = "false";
  return {
    getAttribute(name) {
      return name === "data-item" ? item : null;
    },
    setAttribute(name, value) {
      if (name === "aria-pressed") pressed = value;
    },
    classList: {
      add(name) {
        if (name === "active") active = true;
      },
      remove(name) {
        if (name === "active") active = false;
      },
      contains(name) {
        return name === "active" && active;
      },
    },
    get pressed() {
      return pressed;
    },
  };
}

test("index.html wires pointer-events:auto on .slot so clicks reach slots", () => {
  const slotRule = INDEX_HTML.match(/\.slot \{[^}]+\}/);
  assert.ok(slotRule, "expected .slot CSS rule");
  assert.match(slotRule[0], /pointer-events:\s*auto/);
});

test("index.html exposes hotbar slots as keyboard-activatable buttons", () => {
  assert.match(INDEX_HTML, /class="slot"/);
  assert.match(INDEX_HTML, /role="button"/);
  assert.match(INDEX_HTML, /tabindex="0"/);
  assert.match(INDEX_HTML, /aria-pressed="false"/);
  assert.match(INDEX_HTML, /hud\.addEventListener\("keydown"/);
  assert.match(INDEX_HTML, /ev\.key !== "Enter" && ev\.key !== " "/);
  assert.match(INDEX_HTML, /slot\.click\(\)/);
});

test("index.html wires hotbar clicks through the selector helper shape", () => {
  assert.match(
    INDEX_HTML,
    /function selectHotbarSlot\(slots, clickedSlot, selectedItem\)/,
  );
  assert.match(INDEX_HTML, /selectedTool = selectHotbarSlot\(/);
});

test("selectHotbarSlot activates a clicked inactive item and clears siblings", () => {
  const slots = [
    slot("popberry_seeds"),
    slot("popberry", true),
    slot("whittlewood_log"),
  ];
  const selected = selectHotbarSlot(slots, slots[0], "popberry");
  assert.equal(selected, "popberry_seeds");
  assert.equal(slots[0].classList.contains("active"), true);
  assert.equal(slots[0].pressed, "true");
  assert.equal(slots[1].classList.contains("active"), false);
  assert.equal(slots[1].pressed, "false");
  assert.equal(slots[2].classList.contains("active"), false);
  assert.equal(slots[2].pressed, "false");
});

test("selectHotbarSlot toggles off the already selected item", () => {
  const slots = [slot("popberry", true), slot("whittlewood_log")];
  const selected = selectHotbarSlot(slots, slots[0], "popberry");
  assert.equal(selected, null);
  assert.equal(slots[0].classList.contains("active"), false);
  assert.equal(slots[0].pressed, "false");
});

test("selectHotbarSlot ignores slots without an item", () => {
  const slots = [slot(null), slot("popberry", true)];
  const selected = selectHotbarSlot(slots, slots[0], "popberry");
  assert.equal(selected, "popberry");
  assert.equal(slots[1].classList.contains("active"), true);
});
