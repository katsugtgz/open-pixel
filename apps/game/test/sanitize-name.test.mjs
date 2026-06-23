// Unit tests for sanitizeName() from apps/game/src/modules/main/player.ts (Task 6).
//
// Runs under Node's built-in `node:test` runner. Node >= 22.6 strips TypeScript
// type annotations on import, so the test imports the REAL `.ts` source file
// directly — no build step, no transpiler dependency, no duplicated fixture.
// This locks the ACTUAL shipped behavior of sanitizeName against regressions.
//
// Invoke via: `node --test test/` (or `npm run test -w @open-pixel/game`).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeName } from "../src/modules/main/player.ts";

describe("sanitizeName — happy path", () => {
  it("preserves a simple valid name", () => {
    assert.equal(sanitizeName("Pixel_Roo"), "Pixel_Roo");
  });

  it("preserves a single-character name", () => {
    assert.equal(sanitizeName("A"), "A");
  });

  it("preserves all allowed characters: letters, digits, space, underscore, hyphen", () => {
    assert.equal(sanitizeName("Hero 123 _-X"), "Hero 123 _-X");
    assert.equal(sanitizeName("Test 123-Abc"), "Test 123-Abc");
  });
});

describe("sanitizeName — fallback to 'Hero'", () => {
  it("returns 'Hero' for empty string", () => {
    assert.equal(sanitizeName(""), "Hero");
  });

  it("returns 'Hero' for whitespace-only string", () => {
    assert.equal(sanitizeName("    "), "Hero");
    assert.equal(sanitizeName("\t\t"), "Hero");
  });

  it("returns 'Hero' for undefined", () => {
    assert.equal(sanitizeName(undefined), "Hero");
  });

  it("returns 'Hero' for null", () => {
    assert.equal(sanitizeName(null), "Hero");
  });

  it("returns 'Hero' for numbers (non-string)", () => {
    assert.equal(sanitizeName(123), "Hero");
    assert.equal(sanitizeName(0), "Hero");
    assert.equal(sanitizeName(-1), "Hero");
  });

  it("returns 'Hero' for objects and arrays (non-string)", () => {
    assert.equal(sanitizeName({ name: "X" }), "Hero");
    assert.equal(sanitizeName(["Array"]), "Hero");
  });

  it("returns 'Hero' when only forbidden characters remain after stripping", () => {
    // Angle brackets are stripped -> empty -> fallback.
    assert.equal(sanitizeName("<><>"), "Hero");
    assert.equal(sanitizeName("<<<<"), "Hero");
    assert.equal(sanitizeName("===="), "Hero");
    assert.equal(sanitizeName("()()"), "Hero");
  });
});

describe("sanitizeName — length cap (16 chars)", () => {
  it("clamps a 20-character name to the first 16", () => {
    assert.equal(sanitizeName("A".repeat(20)), "A".repeat(16));
  });

  it("clamps the documented boundary string", () => {
    // 20 chars -> first 16 (ABCDEFGHIJKLMNOP)
    assert.equal(
      sanitizeName("ABCDEFGHIJKLMNOPQRST"),
      "ABCDEFGHIJKLMNOP",
    );
  });

  it("preserves a name at exactly 16 chars", () => {
    assert.equal(sanitizeName("A".repeat(16)), "A".repeat(16));
  });
});

describe("sanitizeName — whitespace trimming", () => {
  it("trims leading and trailing whitespace", () => {
    assert.equal(sanitizeName("  Pixel  "), "Pixel");
  });

  it("trims trailing whitespace", () => {
    assert.equal(sanitizeName("NameWithSpaces  "), "NameWithSpaces");
  });
});

describe("sanitizeName — XSS payload hardening (Task 6 security contract)", () => {
  // The regex /[^A-Za-z0-9 _-]/g STRIPS every character outside the safe set.
  // For XSS payloads this leaves harmless residual TEXT (letters/digits/space),
  // never empty. RPG-JS renders player.name as a plain-text Pixi bitmap label
  // (no innerHTML / insertAdjacentHTML), so even the residual cannot execute.
  // These tests lock both layers: char-stripping AND the fallback guarantee.

  it("strips a <script> tag to harmless residual text (not empty)", () => {
    const result = sanitizeName("<script>alert(1)</script>");
    // 18 chars -> clamp to 16: "scriptalert1scri"
    assert.equal(result, "scriptalert1scri");
    // Security: no angle brackets, parens, or equals survive.
    assert.ok(!result.includes("<"), "no '<' in result");
    assert.ok(!result.includes(">"), "no '>' in result");
    assert.ok(!result.includes("("), "no '(' in result");
    assert.ok(!result.includes(")"), "no ')' in result");
    // Residual only contains safe charset.
    assert.match(result, /^[A-Za-z0-9 _-]*$/);
  });

  it("strips an <img onerror> payload to harmless residual text", () => {
    const result = sanitizeName("<img src=x onerror=alert(1)>");
    // After stripping <, >, =, (, ): "img srcx onerroralert1" (21 chars) -> 16.
    assert.equal(result, "img srcx onerror");
    assert.ok(!result.includes("<"));
    assert.ok(!result.includes(">"));
    assert.ok(!result.includes("="));
    assert.match(result, /^[A-Za-z0-9 _-]*$/);
  });

  it("strips null bytes", () => {
    const result = sanitizeName("Player\u0000NullByte");
    assert.equal(result, "PlayerNullByte");
    assert.ok(!result.includes("\u0000"));
  });

  it("strips angle brackets from mixed valid+invalid input, keeps inner letters", () => {
    // < and > are removed but the 'l' between them is a letter and survives.
    // So "He<l>o_World" -> "Helo_World" (NOT "Hello_World").
    assert.equal(sanitizeName("He<l>o_World"), "Helo_World");
  });

  it("never returns a string containing dangerous characters", () => {
    // Fuzz: any input with dangerous chars must yield a result free of them.
    const dangerous = ["<", ">", "(", ")", "=", '"', "'", "`", ";", "\\"];
    const payloads = [
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
      "'); DROP TABLE players;--",
      "\"><svg/onload=alert(1)>",
      "name\";fetch('//evil')//",
    ];
    for (const payload of payloads) {
      const result = sanitizeName(payload);
      for (const ch of dangerous) {
        assert.ok(
          !result.includes(ch),
          `result ${JSON.stringify(result)} must not contain ${JSON.stringify(ch)} (input ${JSON.stringify(payload)})`,
        );
      }
    }
  });
});
