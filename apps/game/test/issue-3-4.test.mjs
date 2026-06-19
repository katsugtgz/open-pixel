import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const webApp = read("apps/web/src/App.tsx");
const gameHtml = read("apps/game/index.html");
const events = read("apps/game/src/modules/main/event.ts");
const server = read("apps/game/src/modules/main/server.ts");
const clientConfig = read("apps/game/src/config/config.client.ts");

test("#3 landing page shows controls before game entry", () => {
  const playIndex = webApp.indexOf("Play demo");
  assert.notEqual(playIndex, -1, "expected Play demo CTA");
  const beforePlay = webApp.slice(0, playIndex);

  assert.match(beforePlay, /Arrow keys/i);
  assert.match(beforePlay, /Space/i);
  assert.match(beforePlay, /move/i);
  assert.match(beforePlay, /talk|collect|interact/i);
  assert.doesNotMatch(beforePlay, /WASD/i);
});

test("#3 game screen has a non-blocking controls hint", () => {
  assert.match(gameHtml, /aria-label="Game controls"/);
  assert.match(gameHtml, /Arrow keys move/i);
  assert.match(gameHtml, /Space talks\s*\/\s*collects/i);
  assert.match(gameHtml, /AI Guide/i);
  assert.match(gameHtml, /Pixel Shards/i);
  assert.match(gameHtml, /pointer-events:\s*none/i);
});

test("#3 mobile controls are discoverable", () => {
  assert.match(gameHtml, /joystick/i);
  assert.match(gameHtml, /A (button|talks|collects)/i);
  assert.match(gameHtml, /@media \(pointer:\s*coarse\)/i);
  assert.match(gameHtml, /@media \(pointer:\s*fine\)/i);
  assert.match(
    gameHtml,
    /@media \(min-width:\s*681px\) and \(pointer:\s*fine\)/i,
  );
});

test("#4 map exposes guide plus exactly three shards", () => {
  assert.match(server, /id:\s*"ai-guide"/);
  const shardIds = [...server.matchAll(/id:\s*"shard-\d+"/g)];
  assert.equal(shardIds.length, 3);
});

test("#4 NPC prompt tells player the exact interaction key", () => {
  assert.match(events, /AI Guide/i);
  assert.match(events, /press Space/i);
  assert.match(events, /gather 3 Pixel Shards/i);
});

test("#4 shards use a distinct configured sprite", () => {
  assert.doesNotMatch(events, /PixelShard[\s\S]*?setGraphic\("female"\)/);
  assert.match(events, /setGraphic\("pixel-shard"\)/);
  assert.match(clientConfig, /id:\s*"pixel-shard"/);
  assert.match(clientConfig, /spritesheets\/shard\.png/);
});

test("#4 shard collection gives visible progress", () => {
  assert.match(events, /Progress:\s*\$\{[^}]+}\s*\/3/i);
  assert.match(events, /showNotification\([^)]*Pixel Shard collected/i);
  assert.match(events, /Return to the AI Guide/i);
});

test("#4 quest completion is visible and unlocks claim path", () => {
  assert.match(events, /Quest complete/i);
  assert.match(events, /\+100|100 points/i);
  assert.match(events, /Claim .*badge|badge is ready|claim/i);
});
