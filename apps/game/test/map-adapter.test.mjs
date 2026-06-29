// W2.2/W3.1 TDD - map-adapter: registerMapObjects, eventFromObject, board coverage.
//
// map-adapter.ts imports only type-only symbols from @rpgjs/server and
// @canvasengine/tiled (erased by esbuild), and value imports from ./events/*
// which themselves only use type-only @rpgjs imports. So esbuild can bundle
// map-adapter.ts into pure ESM with @rpgjs/* and @canvasengine/* marked
// external, and we exercise the public surface against lightweight mocks.
//
// Behavior locked:
//   - registerMapObjects must NOT swallow createDynamicEvent rejections
//     (W0.1 §7: no silent failures).
//   - eventFromObject must carry Tiled width/height through so larger objects
//     (trees 64x96, board 64x32) get a correctly sized hitbox.
//   - Every VILLAGE_ORDER must have at least one board placement so it is
//     reachable in-game.
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
const mapAdapterSrc = readFileSync(`${villageDir}map-adapter.ts`, "utf8");

async function bundleModule(srcFile, resolveDir, label) {
  const src = readFileSync(srcFile, "utf8");
  const bundled = await build({
    stdin: {
      contents: src,
      sourcefile: srcFile.split("/").pop(),
      resolveDir,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    external: ["@rpgjs/*", "@canvasengine/*"],
    tsconfigRaw: { compilerOptions: { target: "ES2020" } },
  });
  const tmpDir = mkdtempSync(join(tmpdir(), label));
  const modulePath = join(tmpDir, `${label}.bundle.mjs`);
  writeFileSync(modulePath, bundled.outputFiles[0].text);
  return pathToFileURL(modulePath).href;
}

const mapAdapterUrl = await bundleModule(
  `${villageDir}map-adapter.ts`,
  villageDir,
  "w3-map-adapter",
);
// orders.ts is bundled separately (map-adapter does not re-export orders).
const ordersUrl = await bundleModule(
  `${villageDir}orders.ts`,
  villageDir,
  "w3-orders-for-ma",
);

/**
 * Minimal RpgMap double. Real RpgMap.getLayerByName lives on `map.tiled`
 * (populated by @rpgjs/tiledmap at runtime); we mirror that shape so the
 * LayerReadable contract in map-adapter is exercised faithfully.
 */
function makeMockMap({
  id = "village",
  createDynamicEvent,
  getEvent = () => undefined,
  layers = [],
} = {}) {
  return {
    id,
    getEvent,
    createDynamicEvent,
    tiled: {
      getLayerByName: (name) => layers.find((l) => l.name === name),
    },
  };
}

describe("W3.1 registerMapObjects surfaces createDynamicEvent rejections", () => {
  it("rejects (does not resolve silently) when createDynamicEvent rejects", async () => {
    const { registerMapObjects } = await import(mapAdapterUrl);
    const mockMap = makeMockMap({
      createDynamicEvent: () => Promise.reject(new Error("hook refused")),
      layers: [
        {
          name: "resource_nodes",
          objects: [
            {
              name: "tree_01",
              x: 800,
              y: 416,
              width: 64,
              height: 96,
              properties: [{ name: "kind", value: "tree" }],
            },
          ],
        },
      ],
    });

    await assert.rejects(
      () => registerMapObjects(mockMap),
      (err) => {
        assert.ok(
          err instanceof Error,
          "rejection must be an Error, not a wrapped string",
        );
        assert.match(
          err.message,
          /hook refused/,
          "aggregated error must include the underlying reason",
        );
        return true;
      },
    );
  });
});

describe("W3.1 eventFromObject preserves Tiled object dimensions", () => {
  it("carries width/height through as a hitbox field for multi-tile objects", async () => {
    const { eventFromObject, parseTiledProperties } = await import(
      mapAdapterUrl
    );
    // 64x96 tree - three tiles tall, two wide. Without dimension preservation
    // the runtime would fall back to a single-tile 32x32 interaction hitbox.
    const bigTree = {
      name: "tree_big",
      x: 800,
      y: 416,
      width: 64,
      height: 96,
      properties: [{ name: "kind", value: "tree" }],
    };
    const props = parseTiledProperties(bigTree.properties);
    const placement = eventFromObject(bigTree, props);

    assert.ok(
      placement,
      "eventFromObject must return a placement for kind=tree",
    );
    assert.equal(placement.id, "tree_big");
    assert.equal(placement.x, 800);
    assert.equal(placement.y, 416);
    assert.ok(
      placement.hitbox &&
        placement.hitbox.w === 64 &&
        placement.hitbox.h === 96,
      "placement must carry the Tiled object's width/height as hitbox.{w,h}",
    );
  });

  it("omits hitbox when the Tiled object has no dimensions (point-like)", async () => {
    const { eventFromObject, parseTiledProperties } = await import(
      mapAdapterUrl
    );
    const pointish = {
      name: "plot_01",
      x: 544,
      y: 768,
      width: 0,
      height: 0,
      properties: [{ name: "kind", value: "plot" }],
    };
    const props = parseTiledProperties(pointish.properties);
    const placement = eventFromObject(pointish, props);

    assert.ok(placement);
    assert.equal(
      placement.hitbox,
      undefined,
      "zero-dim objects must not synthesize a hitbox",
    );
  });
});

describe("W3.1 board coverage: every VILLAGE_ORDER has an in-game board", () => {
  it("VILLAGE_EVENTS covers every order id defined in orders.ts", async () => {
    const { VILLAGE_ORDERS } = await import(ordersUrl);
    const { boardPlacements } = await import(mapAdapterUrl);

    const placements = boardPlacements();

    assert.equal(
      placements.length,
      VILLAGE_ORDERS.length,
      `expected one board placement per order (${VILLAGE_ORDERS.length}), got ${placements.length}`,
    );
    for (const order of VILLAGE_ORDERS) {
      const matched = placements.filter((p) => p.orderId === order.id);
      assert.ok(
        matched.length >= 1,
        `order ${order.id} (${order.label}) has no board placement; unreachable in-game`,
      );
    }
  });

  it("boardPlacements returns unique board ids", async () => {
    const { boardPlacements } = await import(mapAdapterUrl);
    const placements = boardPlacements();
    const ids = placements.map((p) => p.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      "board ids must be unique so createDynamicEvent does not collide",
    );
  });
});

describe("W3.2 VILLAGE_HITBOXES: surfaces collisions objectgroup to MapOptions", () => {
  it("is a non-empty readonly array of {id,x,y,width,height}", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);

    assert.ok(Array.isArray(VILLAGE_HITBOXES), "must be an array");
    assert.ok(VILLAGE_HITBOXES.length > 0, "must not be empty");

    for (const hb of VILLAGE_HITBOXES) {
      assert.equal(typeof hb.id, "string", "id must be string");
      assert.ok(hb.id.length > 0, "id must be non-empty");
      assert.equal(typeof hb.x, "number", "x must be number");
      assert.equal(typeof hb.y, "number", "y must be number");
      assert.equal(typeof hb.width, "number", "width must be number");
      assert.equal(typeof hb.height, "number", "height must be number");
      assert.ok(hb.width > 0, "width must be positive");
      assert.ok(hb.height > 0, "height must be positive");
    }
  });

  it("contains a collision_house entry matching village.tmx (x=256 y=448 w=160 h=160)", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);
    const house = VILLAGE_HITBOXES.find((h) => h.id === "collision_house");
    assert.ok(house, "collision_house hitbox must exist (the bug-fix target)");
    assert.deepEqual(
      { x: house.x, y: house.y, width: house.width, height: house.height },
      { x: 256, y: 448, width: 160, height: 160 },
      "collision_house bbox must mirror village.tmx object id=3",
    );
  });

  it("has unique ids matching village.tmx collision_* object names", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);
    const ids = VILLAGE_HITBOXES.map((h) => h.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      "hitbox ids must be unique so addStaticHitbox does not collide",
    );
    const expected = [
      "collision_water",
      "collision_house",
      "collision_tree_01",
      "collision_tree_02",
      "collision_tree_03",
      "collision_mine_01",
      "collision_mine_02",
    ];
    for (const id of expected) {
      assert.ok(ids.includes(id), `expected hitbox ${id} missing`);
    }
  });
});

describe("W4.1 expansion: 7 new tree hitboxes in the 80x80 expansion zone", () => {
  it("VILLAGE_HITBOXES has 14 entries (7 original + 7 expansion trees)", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);
    assert.equal(
      VILLAGE_HITBOXES.length,
      14,
      `expected 14 hitboxes after 80x80 expansion, got ${VILLAGE_HITBOXES.length}`,
    );
  });

  it("each expansion tree hitbox has correct coords + 64x96 box", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);
    const expected = [
      { id: "collision_tree_04", x: 1504, y: 1504 },
      { id: "collision_tree_05", x: 1600, y: 1504 },
      { id: "collision_tree_06", x: 1696, y: 1504 },
      { id: "collision_tree_07", x: 1184, y: 1696 },
      { id: "collision_tree_08", x: 1280, y: 1696 },
      { id: "collision_tree_09", x: 1696, y: 832 },
      { id: "collision_tree_10", x: 1696, y: 928 },
    ];
    for (const e of expected) {
      const hb = VILLAGE_HITBOXES.find((h) => h.id === e.id);
      assert.ok(hb, `missing expansion hitbox ${e.id}`);
      assert.deepEqual(
        { x: hb.x, y: hb.y, width: hb.width, height: hb.height },
        { x: e.x, y: e.y, width: 64, height: 96 },
        `${e.id} bbox must mirror village.tmx expansion object`,
      );
    }
  });

  it("all 14 hitbox ids are unique across original + expansion", async () => {
    const { VILLAGE_HITBOXES } = await import(mapAdapterUrl);
    const ids = VILLAGE_HITBOXES.map((h) => h.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      "expansion + original hitbox ids must all be unique",
    );
    assert.equal(
      VILLAGE_HITBOXES.length,
      14,
      "id uniqueness check assumes the full 14-entry set",
    );
  });
});
