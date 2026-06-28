// W1.4 TDD - asserts each @Item class carries the expected server database
// metadata for the village resource loop.
//
// Why esbuild: items.ts relies on TypeScript experimental decorators (see
// apps/game/tsconfig.json `experimentalDecorators: true`). Node's native
// type-stripping does not transform experimental decorators, so the test uses
// esbuild (a transitive vite dependency) to bundle+transform items.ts into ESM
// that Node can import directly via a blob URL.
//
// Why this works without the RPG-JS injector: the `@Item` decorator from
// @rpgjs/database mutates its target class synchronously at module-eval time
// (see node_modules/@rpgjs/database/src/common.ts `merge`). It sets the static
// `id`, `_type`, and `price` properties plus the prototype `name`/`description`,
// so the metadata is readable right after import - no server boot required.
//
// Locked product line: every item MUST have price === 0. These are off-chain
// resource counters only; no sale value, no token economy, no approvals.
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
const itemsPath = `${villageDir}items.ts`;
const itemsSrc = readFileSync(itemsPath, "utf8");

const bundled = await build({
  stdin: {
    contents: itemsSrc,
    sourcefile: "items.ts",
    resolveDir: villageDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  tsconfigRaw: {
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      target: "ES2020",
    },
  },
});

const code = bundled.outputFiles[0].text;
const tmpDir = mkdtempSync(join(tmpdir(), "w14-items-"));
const modulePath = join(tmpDir, "items.bundle.mjs");
writeFileSync(modulePath, code);
const {
  Popberry,
  PopberrySeeds,
  WhittlewoodLog,
  OchruxMatrix,
} = await import(pathToFileURL(modulePath).href);

function assertItemMetadata(Klass, expected) {
  assert.equal(
    Klass.id,
    expected.id,
    `${expected.name}: static id must match the database key`,
  );
  assert.equal(
    Klass._type,
    "item",
    `${expected.name}: must be tagged as an rpg item database type`,
  );
  assert.equal(
    Klass.price,
    0,
    `${expected.name}: price must be 0 (off-chain only, no token economy)`,
  );
  const instance = new Klass();
  assert.equal(
    instance.name,
    expected.name,
    `${expected.name}: instance name must be set on the prototype`,
  );
  assert.ok(
    typeof instance.description === "string" && instance.description.length > 0,
    `${expected.name}: instance description must be a non-empty string`,
  );
}

describe("W1.4 village @Item database", () => {
  it("Popberry publishes stable id, item type, zero price, name, and description", () => {
    assertItemMetadata(Popberry, {
      id: "popberry",
      name: "Popberry",
    });
  });

  it("PopberrySeeds publishes stable id, item type, zero price, name, and description", () => {
    assertItemMetadata(PopberrySeeds, {
      id: "popberry_seeds",
      name: "Popberry Seeds",
    });
  });

  it("WhittlewoodLog publishes stable id, item type, zero price, name, and description", () => {
    assertItemMetadata(WhittlewoodLog, {
      id: "whittlewood_log",
      name: "Whittlewood Log",
    });
  });

  it("OchruxMatrix publishes stable id, item type, zero price, name, and description", () => {
    assertItemMetadata(OchruxMatrix, {
      id: "ochrux_matrix",
      name: "Ochrux Matrix",
    });
  });

  it("exposes exactly the four village resource-loop items", () => {
    const ids = [Popberry, PopberrySeeds, WhittlewoodLog, OchruxMatrix].map(
      (K) => K.id,
    );
    assert.deepEqual(ids.sort(), [
      "ochrux_matrix",
      "popberry",
      "popberry_seeds",
      "whittlewood_log",
    ]);
  });
});
