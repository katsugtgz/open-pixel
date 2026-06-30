// Regression test for the RPG-JS client animation-gate bug.
//
// Bug: `combineLatest([animationChange$, moving$])` in @rpgjs/client's
// character.ce required `curr === 'stand'` AND `!isMoving` simultaneously
// for the sprite to transition from walk back to stand. Because `moving$`
// is derived from float-animated positions with strict equality, the
// `realAnimationName.set('stand')` call was intermittently skipped when
// the server had already flipped the animation to 'stand' but the client's
// `moving$` had not yet settled. Result: sprite kept cycling walk frames
// after arrow keys were released.
//
// Fix: drop the `&& !isMoving` guard on the `stand` branch. Server is
// already authoritative on movement state (see @rpgjs/common/rooms/Map.ts).
// The `walk && isMoving` guard on the next branch stays — it prevents
// stand→walk flicker.
//
// This test asserts the patched pattern in node_modules and the presence
// of the patch-package patch file (so the fix survives `npm install`).

import { test } from "node:test";
import * as assert from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve from the test file's location (not process.cwd()) so the test works
// regardless of whether it's invoked from apps/game/ or the workspace root.
const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = resolve(TEST_DIR, "..");

const CHARACTER_CE_PATH = resolve(
  GAME_DIR,
  "node_modules/@rpgjs/client/src/components/character.ce",
);

const PATCH_PATH = resolve(
  GAME_DIR,
  "patches/@rpgjs+client+5.0.0-beta.22.patch",
);

function readCharacterCe() {
  return readFileSync(CHARACTER_CE_PATH, "utf8");
}

test("character.ce: stand branch must NOT gate on !isMoving (bug fix present)", () => {
  const src = readCharacterCe();
  // Buggy pattern — must be absent.
  assert.ok(
    !/curr\s*==\s*["']stand["']\s*&&\s*!isMoving/.test(src),
    "stand branch must not gate on !isMoving — its presence reintroduces " +
      "the walk-after-release animation desync bug",
  );
});

test("character.ce: stand branch sets realAnimationName unconditionally on 'stand'", () => {
  const src = readCharacterCe();
  // Fixed pattern — `if (curr == 'stand') {` with no isMoving guard.
  assert.ok(
    /curr\s*==\s*["']stand["']\s*\)\s*\{/.test(src),
    "stand branch must match `if (curr == 'stand') {` so the server-driven " +
      "'stand' animation is applied even while client moving$ is mid-settle",
  );
});

test("character.ce: walk branch MUST still gate on isMoving (anti-flicker)", () => {
  const src = readCharacterCe();
  // Preserved guard — prevents stand→walk flicker when moving$ is true
  // but the server hasn't yet switched animationName to 'walk'.
  assert.ok(
    /curr\s*==\s*["']walk["']\s*&&\s*isMoving/.test(src),
    "walk branch must still gate on isMoving to prevent stand→walk flicker",
  );
});

test("patch-package patch file exists for @rpgjs/client (survives npm install)", () => {
  assert.ok(
    existsSync(PATCH_PATH),
    `patch file must exist at ${PATCH_PATH} — without it the fix is lost on ` +
      `reinstall. Run \`npx patch-package @rpgjs/client\` from apps/game to regenerate.`,
  );
});

test("patch file contains the expected stand-branch diff", () => {
  if (!existsSync(PATCH_PATH)) {
    // Skip with a soft pass when patch is absent; the previous test already
    // fails loudly on missing patch.
    return;
  }
  const patch = readFileSync(PATCH_PATH, "utf8");
  assert.match(
    patch,
    /-\s*if\s*\(curr\s*==\s*['"]stand['"]\s*&&\s*!isMoving\)/,
    "patch must remove the `&& !isMoving` guard from the stand branch",
  );
  assert.match(
    patch,
    /\+\s*if\s*\(curr\s*==\s*['"]stand['"]\)/,
    "patch must add the unguarded `if (curr == 'stand')` form",
  );
});
