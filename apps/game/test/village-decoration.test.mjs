// Village decoration regression test.
//
// Locks the village.tmx grass-variation + Decoration layer behavior added by
// /tmp/village_tile_decorate.py. Pure TMX structural checks via regex/XML
// decode — no esbuild bundling needed, no @rpgjs imports.
//
// Behavior locked:
//   - village.tmx has a "Decoration" layer (visual-only flowers).
//   - Decoration layer has >0 non-zero tile gids.
//   - Ground layer has >1 distinct gid (grass variation exists, not uniform
//     gid=1 anymore).
//   - Flower_pipo tileset is referenced with the expected firstgid so flowers
//     resolve to real tiles and don't bleed into other tileset ranges.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const villageTmxPath = fileURLToPath(
  new URL("../src/tiled/village.tmx", import.meta.url),
);

function decodeLayerGids(tmxText, layerName) {
  // Match <layer name="X" ...> ... <data encoding="base64">B64</data> ...
  // Non-greedy to stop at first </data> after this layer.
  const layerRe = new RegExp(
    `<layer[^>]*name="${layerName}"[^>]*>[\\s\\S]*?<data encoding="base64">([\\s\\S]*?)</data>`,
    "m",
  );
  const m = tmxText.match(layerRe);
  assert.ok(m, `layer ${layerName} not found in village.tmx`);
  const b64 = m[1].replace(/\s+/g, "");
  const buf = Buffer.from(b64, "base64");
  // TMX tiles are uint32 little-endian.
  const gids = [];
  for (let i = 0; i < buf.length; i += 4) {
    gids.push(buf.readUInt32LE(i));
  }
  return gids;
}

describe("village.tmx decoration", () => {
  const tmx = readFileSync(villageTmxPath, "utf8");

  it("village.tmx references [A]Flower_pipo tileset at firstgid 5240", () => {
    // 4216 (lpc-crops firstgid) + 1024 (lpc-crops tilecount) = 5240.
    const ts = /<tileset firstgid="5240" source="\[A\]Flower_pipo\.tsx"/.test(tmx);
    assert.ok(ts, "Flower_pipo tileset missing or firstgid wrong");
  });

  it("has a Decoration layer with >0 non-zero flower tiles", () => {
    const decoGids = decodeLayerGids(tmx, "Decoration");
    assert.equal(decoGids.length, 80 * 80, "Decoration layer wrong tile count");
    const nonZero = decoGids.filter((g) => g !== 0);
    assert.ok(nonZero.length > 0, "Decoration layer has no flower tiles");
    // Sanity: every non-zero tile falls inside Flower_pipo range
    // (firstgid 5240 .. 5240+96).
    for (const g of nonZero) {
      assert.ok(
        g >= 5240 && g < 5240 + 96,
        `flower gid ${g} outside Flower_pipo range`,
      );
    }
  });

  it("Ground layer has grass variation (>1 distinct non-zero gid)", () => {
    const groundGids = decodeLayerGids(tmx, "Ground");
    assert.equal(groundGids.length, 80 * 80, "Ground layer wrong tile count");
    const distinct = new Set(groundGids.filter((g) => g !== 0));
    assert.ok(
      distinct.size > 1,
      `Ground layer uniform — expected grass variation, got gids: ${[...distinct]}`,
    );
    // Specifically: at least 3 of the 6 lpc-grass variants (gids 1..6) present.
    const grassVariants = [...distinct].filter((g) => g >= 1 && g <= 6);
    assert.ok(
      grassVariants.length >= 3,
      `expected >=3 grass variants, got ${grassVariants}`,
    );
  });

  it("Decoration layer is visual-only: no collision objects added", () => {
    // Sanity: the collisions objectgroup still has the original count and the
    // Decoration is a <layer>, not an <objectgroup>. We just confirm no new
    // "decor_collision" or similar leaked in.
    const collisions = tmx.match(/<object[^>]*class="collision"/g) || [];
    // 14 collision rects existed before decoration (2 water/house + 10 trees + 2 mines).
    assert.equal(collisions.length, 14, "collision count drifted from 14");
  });
});
