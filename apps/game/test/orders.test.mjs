// W3.1 TDD - village order fulfillment + inventory adapter.
//
// orders.ts imports inventory.ts (relative) plus a type-only RpgPlayer from
// @rpgjs/server, so esbuild can bundle it into pure ESM (the type import is
// erased) and we exercise canFulfill + fulfillOrder against a lightweight mock
// player. The mock mirrors the verified RPG-JS v5 runtime semantics:
//   - getItem(id) returns undefined when the item is missing (the TS signature
//     is non-undefined, but the impl in ItemManager.ts returns items()[index],
//     which is undefined for index -1).
//   - Item.quantity() is the signal read returning the stack count.
//   - hasItem(id) is !!getItem(id).
// Behavior is asserted through the public surface (add/count/consume/snapshot,
// canFulfill, fulfillOrder) so the tests survive internal refactors.
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
const ordersSrc = readFileSync(`${villageDir}orders.ts`, "utf8");

const bundled = await build({
  stdin: {
    contents: ordersSrc,
    sourcefile: "orders.ts",
    resolveDir: villageDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  tsconfigRaw: { compilerOptions: { target: "ES2020" } },
});

const tmpDir = mkdtempSync(join(tmpdir(), "w31-orders-"));
const modulePath = join(tmpDir, "orders.bundle.mjs");
writeFileSync(modulePath, bundled.outputFiles[0].text);
const { VILLAGE_ORDERS, findOrder, canFulfill, fulfillOrder } = await import(
  pathToFileURL(modulePath).href
);

/**
 * Minimal RpgPlayer double exposing only the item + variable surface the
 * village inventory/orders code touches. `getItem` returns undefined for
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

describe("W3.1 VILLAGE_ORDERS catalogue", () => {
  it("defines at least two orders so the board has a choice", () => {
    assert.ok(VILLAGE_ORDERS.length >= 2);
  });

  it("exposes order_01 (Berry Basket) and order_02 (Builder's Kit)", () => {
    const ids = VILLAGE_ORDERS.map((o) => o.id);
    assert.ok(ids.includes("order_01"), "must expose order_01");
    assert.ok(ids.includes("order_02"), "must expose order_02");
  });

  it("every order requires at least one resource and awards positive points", () => {
    for (const order of VILLAGE_ORDERS) {
      assert.ok(
        Object.keys(order.requires).length > 0,
        `${order.id}: must require at least one resource`,
      );
      assert.ok(
        order.rewardPoints > 0,
        `${order.id}: rewardPoints must be positive (off-chain points only)`,
      );
    }
  });
});

describe("W3.1 findOrder", () => {
  it("returns the order for a known id", () => {
    assert.equal(findOrder("order_01")?.label, "Berry Basket");
  });

  it("returns undefined for an unknown id", () => {
    assert.equal(findOrder("nope"), undefined);
  });
});

describe("W3.1 canFulfill (pure snapshot check)", () => {
  it("returns false for an unknown order", () => {
    assert.equal(canFulfill({ popberry: 99 }, "nope"), false);
  });

  it("order_01: false when popberry below 2", () => {
    assert.equal(canFulfill({ popberry: 1 }, "order_01"), false);
    assert.equal(canFulfill({ popberry: 0 }, "order_01"), false);
  });

  it("order_01: true when popberry is exactly 2 (boundary)", () => {
    assert.equal(canFulfill({ popberry: 2 }, "order_01"), true);
  });

  it("order_01: true when popberry exceeds 2", () => {
    assert.equal(canFulfill({ popberry: 5 }, "order_01"), true);
  });

  it("order_02: false when one of two requirements is missing", () => {
    assert.equal(
      canFulfill(
        { popberry: 0, whittlewood_log: 2, ochrux_matrix: 0 },
        "order_02",
      ),
      false,
    );
  });

  it("order_02: true when both requirements are met", () => {
    assert.equal(
      canFulfill(
        { popberry: 0, whittlewood_log: 2, ochrux_matrix: 1 },
        "order_02",
      ),
      true,
    );
  });
});

describe("W3.1 fulfillOrder (player mutation)", () => {
  it("returns not-ok for an unknown order and mutates nothing", () => {
    const player = makePlayer({ popberry: 3 }, 10);
    const result = fulfillOrder(player, "nope");
    assert.deepEqual(result, {
      ok: false,
      reason: "Unknown order",
      pointsEarned: 0,
    });
    assert.equal(player.items.popberry, 3);
    assert.equal(player.vars.village_points, 10);
  });

  it("returns not-ok when resources are insufficient and drains nothing", () => {
    const player = makePlayer({ popberry: 1 }, 0);
    const result = fulfillOrder(player, "order_01");
    assert.equal(result.ok, false);
    assert.equal(result.reason, "Not enough resources");
    assert.equal(result.pointsEarned, 0);
    assert.equal(player.items.popberry, 1);
    assert.equal(player.vars.village_points, 0);
  });

  it("order_01 fulfillment consumes 2 popberry, leaves the rest, +25 points", () => {
    const player = makePlayer({ popberry: 3 }, 0);
    const result = fulfillOrder(player, "order_01");
    assert.deepEqual(result, { ok: true, pointsEarned: 25 });
    assert.equal(player.items.popberry, 1, "consumes exactly the required 2");
    assert.equal(player.vars.village_points, 25);
  });

  it("order_02 fulfillment consumes multi-resource requirements, +40 points", () => {
    const player = makePlayer({ whittlewood_log: 2, ochrux_matrix: 1 }, 5);
    const result = fulfillOrder(player, "order_02");
    assert.deepEqual(result, { ok: true, pointsEarned: 40 });
    assert.equal(player.items.whittlewood_log, 0);
    assert.equal(player.items.ochrux_matrix, 0);
    assert.equal(player.vars.village_points, 45, "accumulates onto existing");
  });

  it("order_02 is all-or-nothing: missing ochrux leaves whittlewood untouched", () => {
    const player = makePlayer({ whittlewood_log: 2, ochrux_matrix: 0 }, 0);
    const result = fulfillOrder(player, "order_02");
    assert.equal(result.ok, false);
    assert.equal(player.items.whittlewood_log, 2, "no partial drain");
    assert.equal(player.vars.village_points, 0);
  });
});
