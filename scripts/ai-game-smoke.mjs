#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";
import {
  GAME_SMOKE_CONTRACT,
  getGamePreviewUrl,
  isGameAssetUrl,
} from "../apps/game/src/config/gameSmokeContract.js";

const MOVEMENT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

// Known fixed sprite positions on simplemap (smoke-side mirror of
// apps/game/src/modules/main/layoutRoles.ts MAP_ROLES). Used by
// findPlayerPos() to filter out non-player sprites (AI Guide + 3 shards)
// when identifying the player from captured PIXI positions. AI Guide
// entry matches GAME_SMOKE_CONTRACT.quest.guidePosition.
const SCRIPTED_FIXED_EVENTS = [
  { x: 384, y: 352 },
  { x: 176, y: 336 },
  { x: 624, y: 336 },
  { x: 400, y: 528 },
];
const SCRIPTED_FACINGS = ["ArrowDown", "ArrowRight", "ArrowLeft", "ArrowUp"];

const config = {
  url: process.env.AI_GAME_URL || process.argv[2] || getGamePreviewUrl(),
  headless: process.env.AI_GAME_HEADLESS !== "false",
  maxSteps: numberEnv("AI_GAME_MAX_STEPS", 30),
  stepDelayMs: numberEnv("AI_GAME_STEP_DELAY_MS", 450),
  outputDir: process.env.AI_GAME_OUTPUT_DIR || "artifacts/ai-game-smoke",
  useVlm: process.env.AI_GAME_VLM_ENABLED === "1",
  vlmBaseUrl: process.env.AI_GAME_VLM_BASE_URL || "",
  vlmModel: process.env.AI_GAME_VLM_MODEL || "",
  vlmApiKey: process.env.AI_GAME_VLM_API_KEY || "dummy",
};

mkdirSync(config.outputDir, { recursive: true });
const preview = process.env.AI_GAME_URL ? null : await startPreview();
const pageErrors = [];
const failedRequests = [];
const steps = [];
let browser;
let passed = false;
let reason = "unknown";

try {
  browser = await chromium.launch({
    headless: config.headless,
    executablePath: findChromiumExecutable(),
    timeout: 30_000,
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      pageErrors.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && isGameAssetUrl(response.url())) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (isGameAssetUrl(request.url())) {
      failedRequests.push(
        `request failed ${request.url()}: ${request.failure()?.errorText || "unknown"}`,
      );
    }
  });

  await page.goto(config.url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector(GAME_SMOKE_CONTRACT.canvasSelector, {
    timeout: 25_000,
  });
  await page.waitForTimeout(2_000);
  await page.keyboard.press("Tab").catch(() => {});

  let lastHash = "";
  let changedFrames = 0;
  let stableFrames = 0;
  let froze = false;
  const actions = initialActions();
  // Scripted-mode controller: adaptive position-aware action selection that
  // approaches the AI Guide and tries onAction from each adjacent facing.
  // VLM mode ignores this and uses askVlmForAction with `actions` as fallback.
  const scriptedCtrl = makeScriptedController();
  // VLM mode keeps the longer maxSteps budget for autonomous exploration.
  // Scripted mode is bounded by config.maxSteps; the controller signals
  // completion by returning null (which also breaks the loop below).
  const loopLimit = config.maxSteps;

  for (let index = 0; index < loopLimit; index += 1) {
    const screenshot = await page.screenshot({ fullPage: false });
    const hash = createHash("sha256").update(screenshot).digest("hex");
    const screenshotPath = join(
      config.outputDir,
      `step-${String(index).padStart(2, "0")}.png`,
    );
    writeFileSync(screenshotPath, screenshot);

    if (lastHash && hash !== lastHash) {
      changedFrames += 1;
      stableFrames = 0;
    }
    if (lastHash && hash === lastHash) stableFrames += 1;
    lastHash = hash;

    const canvas = await page
      .locator(GAME_SMOKE_CONTRACT.canvasSelector)
      .boundingBox();
    // Capture ground-truth gameplay state (sprite position + dialog text) so
    // the pass criteria can verify real movement/quest progress instead of
    // relying on screenshot-hash diversity alone.
    const gameState = await captureGameState(page);
    const action = config.useVlm
      ? await askVlmForAction({
          screenshot,
          index,
          steps,
          fallback: actions[index % actions.length],
        })
      : nextScriptedAction(gameState, scriptedCtrl);

    if (!action) {
      // Scripted controller signalled completion (all facings tried).
      break;
    }

    await executeAction(page, action);
    await sleep(config.stepDelayMs);

    steps.push({
      index,
      action,
      hash,
      screenshot: screenshotPath,
      canvas,
      gameState: gameState.allPositions,
      // Real RPG-JS showText() dialog body (.rpg-ui-dialog-body). Empty
      // unless an onAction hook opened a dialog. NOT the HUD hint.
      dialogText: gameState.dialog,
      hudText: gameState.hud,
      stageAlive: gameState.stageAlive,
      dialogDebug: gameState.dialogDebug,
    });

    if (
      stableFrames >= GAME_SMOKE_CONTRACT.movement.freezeFrameLimit &&
      // An open RPG-JS showText() dialog legitimately stabilises the
      // screen once the typewriter finishes — that is gameplay progress
      // (onAction fired, quest text is showing), NOT a softlock. Skip
      // the freeze trip when a real dialog body is present.
      !gameState.dialog
    ) {
      froze = true;
      reason = `visual freeze/softlock: screenshot unchanged for ${GAME_SMOKE_CONTRACT.movement.freezeFrameLimit} consecutive observed frames`;
      break;
    }
  }

  if (froze) reason = reason;
  else if (pageErrors.length) reason = "page/console errors detected";
  else if (failedRequests.length) reason = "game asset requests failed";
  else if (steps.length < Math.min(4, config.maxSteps))
    reason = "agent loop stopped too early";
  else if (
    !steps.some(
      (step) =>
        step.canvas?.width > GAME_SMOKE_CONTRACT.movement.minCanvasWidth &&
        step.canvas?.height > GAME_SMOKE_CONTRACT.movement.minCanvasHeight,
    )
  )
    reason = "RPG-JS canvas missing or too small";
  else if (steps.length >= Math.min(8, config.maxSteps)) {
    const uniqueHashes = new Set(steps.map((step) => step.hash)).size;
    // Stronger pass criteria: verify ACTUAL gameplay progress, not just visual
    // changes. Screenshot hashes can diverge from HUD/animation jitter even
    // when the player never moves, producing false positives.
    //
    // Player position identification: collect the set of all sprite positions
    // observed at step 0 (the static map baseline), then for each subsequent
    // step find the sprite whose position is NOT in that baseline. That moving
    // sprite is the player; the count of distinct player positions across the
    // run is the real "did the character move" signal.
    const baseline = new Set(steps[0]?.gameState || []);
    // Track a stable sprite identity across steps. The previous approach
    // (all.find((p) => !baseline.has(p)) on every step) could pick a DIFFERENT
    // non-baseline sprite each step — e.g. transient sprites appearing at
    // different positions — and falsely satisfy uniquePositions >= 3 without
    // the player actually moving. We now lock onto the player once and follow
    // it by nearest-neighbor distance so the same character is tracked across
    // the whole run.
    let lastPlayer = null; // stable identity: previous-step player position
    const playerPositions = steps.map((s) => {
      const all = (s.gameState || []).filter((p) => parsePos(p));
      if (all.length === 0)
        return lastPlayer ? `${lastPlayer.x},${lastPlayer.y}` : null;
      // Lock-on phase: no player identified yet. Look for a sprite position
      // that is new relative to the step-0 baseline (= the player moved).
      if (lastPlayer === null) {
        const moved = all.find((p) => !baseline.has(p));
        if (moved) {
          lastPlayer = parsePos(moved);
        }
        // Return the (possibly baseline) chosen position so step 0 and the
        // first move both contribute real values.
        return moved || all[0];
      }
      // Tracking phase: choose the sprite nearest to last known player
      // position. This keeps us following the same character even if other
      // transient sprites enter/leave the viewport.
      let best = all[0];
      let bestDist = Infinity;
      for (const p of all) {
        const pos = parsePos(p);
        const dist = Math.hypot(pos.x - lastPlayer.x, pos.y - lastPlayer.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = p;
        }
      }
      lastPlayer = parsePos(best);
      return best;
    });
    const uniquePositions = new Set(playerPositions.filter(Boolean)).size;

    // Interaction evidence: at least one Space-press step must have had the
    // tracked player within the guide's onAction range. captureGameState()
    // runs BEFORE the step's action, so a Space step's playerPositions[i] is
    // exactly where the player was when Space went down — which is what
    // determines whether RPG-JS Control.Action fires onAction.
    const guide = GAME_SMOKE_CONTRACT.quest.guidePosition;
    const range = GAME_SMOKE_CONTRACT.quest.interactionRange;
    let closestSpaceDist = Infinity;
    let inRangeSpacePresses = 0;
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i];
      if (step.action?.type !== "key" || step.action.key !== "Space") continue;
      const pos = parsePos(playerPositions[i]);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - guide.x, pos.y - guide.y);
      if (dist < closestSpaceDist) closestSpaceDist = dist;
      if (dist <= range) inRangeSpacePresses += 1;
    }

    // Real RPG-JS dialog body text (NOT HUD hint) observed at any step. The
    // dialog often lags the Space press by one capture, so we scan all steps
    // rather than only Space steps.
    const dialogTexts = steps.map((s) => s.dialogText).filter(Boolean);
    const dialogPhrases = GAME_SMOKE_CONTRACT.quest.dialogPhrases;
    const realDialogMatch = dialogTexts.some((d) =>
      dialogPhrases.some((p) => d.toLowerCase().includes(p.toLowerCase())),
    );

    // Stage-alive: PIXI stage was still traversable on the final captured
    // step. If onAction or showText crashed the engine, this goes to 0.
    const lastStep = steps[steps.length - 1];
    const stageAlive = (lastStep?.gameState?.length ?? 0) > 0;

    if (uniqueHashes < GAME_SMOKE_CONTRACT.movement.minUniqueFrames)
      reason = `low visual progress: fewer than ${GAME_SMOKE_CONTRACT.movement.minUniqueFrames} unique frames`;
    else if (
      uniquePositions < GAME_SMOKE_CONTRACT.movement.minUniquePlayerPositions
    )
      reason = `character did not move enough: only ${uniquePositions} unique sprite positions (need >= ${GAME_SMOKE_CONTRACT.movement.minUniquePlayerPositions}); screenshots changed but player stayed put`;
    else if (inRangeSpacePresses === 0)
      reason = `quest interaction NOT exercised: Space was never pressed within ${range}px of AI Guide at (${guide.x},${guide.y}); closest Space-press distance was ${Math.round(
        closestSpaceDist,
      )}px (spawn-side press, onAction could not fire)`;
    else if (!realDialogMatch)
      reason = `quest interaction NOT verified: ${inRangeSpacePresses} in-range Space press(es) produced no real .rpg-ui-dialog-body text matching ${JSON.stringify(
        dialogPhrases,
      )}; dialog bodies seen: ${JSON.stringify(dialogTexts)}`;
    else if (!stageAlive)
      reason =
        "stage died after Space: no sprite positions on final step (RPG-JS PIXI stage unreadable)";
    else {
      passed = true;
      reason = `AI game smoke flow passed: ${uniqueHashes} unique frames, ${uniquePositions} unique sprite positions, ${inRangeSpacePresses} in-range Space press(es), real RPG-JS dialog matched, stage alive`;
    }
  }
} catch (error) {
  reason = error?.stack || error?.message || String(error);
} finally {
  await browser?.close();
  stopPreview(preview);
  const report = {
    passed,
    reason,
    url: config.url,
    mode: config.useVlm ? "vlm-agent" : "scripted-agent-fallback",
    pageErrors,
    failedRequests,
    steps,
    artifacts: config.outputDir,
    timestamp: new Date().toISOString(),
  };
  writeFileSync(
    join(config.outputDir, "report.json"),
    JSON.stringify(report, null, 2),
  );
  writeFileSync(join(config.outputDir, "summary.md"), toMarkdown(report));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = passed ? 0 : 1;
}

function initialActions() {
  // Used only as VLM-mode fallback. The scripted (non-VLM) path uses
  // nextScriptedAction() below, which adapts to captured player position
  // because RPG-JS server-authoritative movement produces variable pixels
  // per key hold (10-50px) and a fixed script cannot reliably land the
  // player in the guide's tile-adjacency band.
  return [
    { type: "key", key: "ArrowDown", note: "vlm fallback: approach south" },
    { type: "key", key: "ArrowDown", note: "vlm fallback: approach south" },
    { type: "key", key: "Space", note: "vlm fallback: interact" },
    { type: "key", key: "Enter", note: "vlm fallback: dismiss dialog" },
  ];
}

// Adaptive scripted-mode controller. Phases:
//   "approach-y": long ArrowDown/ArrowUp presses until player's y is within
//                 ~1 tile of the guide's y (so they share an adjacent row)
//   "approach-x": long ArrowLeft/ArrowRight presses until player's x is in
//                 the guide's tile column (RPG-JS onAction hitbox is the
//                 tile directly in front of the player, so x must match)
//   "interact":   for each of the 4 facings, queue (face-tap, Space, Enter).
//                 The face-tap is a normal movement press in that direction;
//                 if it lands the player adjacent on the matching side,
//                 facing now points at the guide and Space fires onAction.
//
// RPG-JS RULE: pressing a direction key both moves the player one tile and
// rotates facing to that direction. There is no face-only input. So we
// cannot change facing without also moving; the interact-phase taps each
// direction in turn, accepting that some taps move us out of range. As
// long as ONE tap lands adjacent-with-correct-facing, the subsequent Space
// fires onAction and the pass gate sees the dialog.
// Identify the player sprite from captured PIXI positions.
//
// The PIXI viewport contains many sprites (map tiles, the AI Guide, the
// 3 shards, the player, particle effects). We can't ask RPG-JS directly
// from page.evaluate without coupling to engine internals, so we infer:
// the player is the sprite whose position is NOT one of the known fixed
// event positions (SCRIPTED_FIXED_EVENTS, AI Guide + 3 shards from
// layoutRoles MAP_ROLES) and is closest to the guide (since we just
// approached). Layout coords are duplicated as smoke-side ground truth
// (same justification as GAME_SMOKE_CONTRACT.quest.guidePosition).
function findPlayerPos(gameState, guide) {
  const positions = (gameState?.allPositions || [])
    .map(parsePos)
    .filter(Boolean);
  if (positions.length === 0) return null;
  const isFixed = (p) =>
    SCRIPTED_FIXED_EVENTS.some(
      (ev) => Math.abs(ev.x - p.x) < 12 && Math.abs(ev.y - p.y) < 12,
    );
  const candidates = positions.filter((p) => !isFixed(p));
  if (candidates.length === 0) return null;
  // Prefer the candidate closest to the guide (we are approaching it).
  // Ties go to the smaller y (northernmost), an arbitrary but stable rule.
  let best = candidates[0];
  let bestDist = Math.hypot(best.x - guide.x, best.y - guide.y);
  for (const p of candidates.slice(1)) {
    const d = Math.hypot(p.x - guide.x, p.y - guide.y);
    if (d < bestDist || (d === bestDist && p.y < best.y)) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

// Adaptive scripted-mode controller. Phases:
//   "approach":   long ArrowDown/ArrowUp/Left/Right presses until the player
//                 is within GAME_SMOKE_CONTRACT.quest.interactionRange of
//                 the guide (moves along whichever axis has the larger gap).
//   "interact":   for each of the 4 facings, queue (face-tap, Space, Enter).
//                 The face-tap is a normal movement press in that direction;
//                 if it lands the player adjacent on the matching side,
//                 facing now points at the guide and Space fires onAction.
//
// RPG-JS RULE: pressing a direction key both moves the player one tile and
// rotates facing to that direction. There is no face-only input. So we
// cannot change facing without also moving; the interact-phase taps each
// direction in turn, accepting that some taps move us out of range. As
// long as ONE tap lands adjacent-with-correct-facing, the subsequent Space
// fires onAction and the pass gate sees the dialog.
// SCRIPTED_FACINGS is declared at the top of the file (alongside other
// module constants) to avoid TDZ issues — the main try-block runs before
// this helper section is reached.

function makeScriptedController() {
  return {
    queue: [],
    // Track facings we've already queued so we don't retry forever.
    triedFacings: new Set(),
    // Count of full approach-interact cycles; bound the total work.
    cycles: 0,
  };
}

function nextScriptedAction(gameState, ctrl) {
  // Drain queued actions first — face-tap/Space/Enter sequences are queued
  // together so they always run in the right order regardless of captures.
  if (ctrl.queue.length > 0) return ctrl.queue.shift();

  const guide = GAME_SMOKE_CONTRACT.quest.guidePosition;
  const player = findPlayerPos(gameState, guide);
  if (!player) {
    // No player position detected (PIXI read failed or sprite obscured).
    // Default to a southward press to make progress; the loop's maxSteps
    // bound prevents infinite iteration.
    return {
      type: "key",
      key: "ArrowDown",
      note: "no player detected; default southward press",
    };
  }

  // RPG-JS onAction hitbox is TILE-BASED, not pixel-based: pressing Space
  // while facing direction D activates the event on the tile directly in
  // front of the player (playerTile + facing delta). Pixel proximity is
  // NOT enough — the player must be on a tile orthogonally adjacent to
  // the guide's tile, with facing pointing at it.
  //
  // Tile size is 32px (RPG-JS default). Guide pixel (384, 352) lives on
  // tile (12, 11). We navigate the player to the tile NORTH of the guide
  // (12, 10) = pixel centre ~(400, 320), approaching via ArrowDown so the
  // player's facing ends up SOUTH — pointing directly at the guide. Then
  // Space fires onAction on the guide tile.
  //
  // SERVER-SYNC LAG: RPG-JS is server-authoritative. The PIXI-read
  // position can lag the server-side position by 1 tile during movement.
  // So even when the client shows the player on the optimal tile, the
  // server might still see them one tile away. We handle this by retrying
  // Space several times across multiple approach cycles, accepting that
  // onAction fires nondeterministically.
  const TILE = 32;
  const guideTile = {
    x: Math.round(guide.x / TILE),
    y: Math.round(guide.y / TILE),
  };
  const playerTile = {
    x: Math.floor(player.x / TILE),
    y: Math.floor(player.y / TILE),
  };
  const tileDx = Math.abs(playerTile.x - guideTile.x);
  const tileDy = Math.abs(playerTile.y - guideTile.y);
  const isTileAdjacent =
    (tileDx === 1 && tileDy === 0) || (tileDx === 0 && tileDy === 1);

  // Phase 1: navigate onto a tile orthogonally adjacent to the guide.
  // Prefer the NORTH tile (so the player's natural southward approach
  // leaves them facing the guide), but accept any of the 4 adjacents.
  if (!isTileAdjacent) {
    // Step 1a: align to guide's tile column first. Without column
    // alignment, south-facing onAction fires on the wrong column.
    if (playerTile.x !== guideTile.x) {
      const dx = guide.x - player.x;
      return {
        type: "key",
        key: dx > 0 ? "ArrowRight" : "ArrowLeft",
        note: `tile-align to guide column ${guideTile.x} (dx=${Math.round(dx)})`,
      };
    }
    // Step 1b: aligned in x; move south/north until tile-adjacent in y.
    // We want to land on the tile NORTH of the guide (playerTile.y ===
    // guideTile.y - 1) so the previous ArrowDown left us facing south.
    const targetTileY = guideTile.y - 1;
    if (playerTile.y > targetTileY) {
      return {
        type: "key",
        key: "ArrowUp",
        note: `overshot south; back up to tile row ${targetTileY}`,
      };
    }
    return {
      type: "key",
      key: "ArrowDown",
      note: `approach guide: south to tile row ${targetTileY}`,
    };
  }

  // Phase 2: tile-adjacent. Try Space directly (player is already facing
  // the guide from the approach), then cycle through other facings. If
  // all facings are tried without dialog, reset and re-approach (server
  // position may have lagged; a fresh approach gives the engine another
  // chance to sync).
  ctrl.cycles += 1;
  // Allow up to 3 full approach+interact cycles. Each cycle is ~8 actions
  // (4 facings × (face+Space+Enter) + re-approach), so 3 cycles ≈ 24
  // actions. The harness's maxSteps default (18) bounds total work.
  if (ctrl.cycles > SCRIPTED_FACINGS.length * 3) {
    return null;
  }
  // If we've tried all facings in this cycle, reset and let Phase 1
  // re-navigate (the face-taps will have moved us off the optimal tile).
  if (ctrl.triedFacings.size >= SCRIPTED_FACINGS.length) {
    ctrl.triedFacings = new Set();
    // Fall through to Phase 1 re-evaluation on next call. Force re-approach
    // by issuing a brief ArrowDown (which also reinforces south-facing).
    return {
      type: "key",
      key: "ArrowDown",
      note: "cycle boundary: nudge south + refresh facing before re-approach",
    };
  }
  const nextFacing = SCRIPTED_FACINGS.find((f) => !ctrl.triedFacings.has(f));
  if (!nextFacing) return null;
  ctrl.triedFacings.add(nextFacing);
  const FACE_HOLD_MS = 300;
  ctrl.queue.push(
    {
      type: "key",
      key: nextFacing,
      holdMs: FACE_HOLD_MS,
      note: `face ${nextFacing}`,
    },
    { type: "key", key: "Space", note: `onAction (facing ${nextFacing})` },
    { type: "key", key: "Enter", note: "dismiss showText dialog if it opened" },
  );
  return ctrl.queue.shift();
}

async function executeAction(page, action) {
  if (!action || action.type === "wait") return;
  if (action.type === "key") {
    // RPG-JS / canvasengine only processes input on preStep() ticks and only
    // when getDirection()==="none". An instant keydown+keyup from press()
    // usually fires keyup before the engine's ~160ms movement frame, so the
    // player never moves. We hold movement keys long enough to cover several
    // engine ticks; action keys (Space/Enter) trigger on keydown but we still
    // hold briefly to avoid missing the engine frame.
    //
    // Per-action holdMs override is supported so the script can issue short
    // "face-only" direction taps (~150ms): long enough for the engine to
    // register keydown and rotate the player's facing, short enough to
    // minimise actual tile movement. This is required because RPG-JS
    // onAction only fires when the player is FACING the adjacent event, so
    // after approaching the guide we must try multiple facings.
    const isMovement = MOVEMENT_KEYS.has(action.key);
    const defaultHoldMs = isMovement
      ? numberEnv("AI_GAME_MOVE_HOLD_MS", 700)
      : numberEnv("AI_GAME_ACTION_HOLD_MS", 200);
    const holdMs =
      Number.isFinite(action.holdMs) && action.holdMs > 0
        ? action.holdMs
        : defaultHoldMs;
    await page.keyboard.down(action.key);
    await sleep(holdMs);
    await page.keyboard.up(action.key);
    // RPG-JS showText() renders dialog text with a typewriter effect
    // (~30-50ms per char). After pressing Space — which is the only key
    // that fires onAction → showText() — we must wait long enough for
    // the full text to render so the next captureGameState() observes
    // complete dialog content instead of a truncated prefix. ~3s covers
    // the longest guide line (~100 chars). Other keys (movement, Enter)
    // don't need this wait.
    if (action.key === "Space") {
      await sleep(numberEnv("AI_GAME_POST_SPACE_WAIT_MS", 3000));
    }
    return;
  }
  if (action.type === "text") return page.keyboard.type(action.text || "");
  if (action.type === "click") return page.mouse.click(action.x, action.y);
  throw new Error(`unsupported action: ${JSON.stringify(action)}`);
}

// Reads ground-truth gameplay state from the live page:
//   - all in-world sprite positions via the PIXI stage tree (window.__PIXI_STAGE__)
//   - stageAlive: true iff the PIXI stage was traversable this capture
//   - real RPG-JS dialog body text via GAME_SMOKE_CONTRACT.dialogSelector
//     (only present while a showText() dialog is open)
//   - static React-shell HUD text via GAME_SMOKE_CONTRACT.hudSelector
//     (always present at /game/, must NOT be confused with dialog)
//
// The player sprite is not at a fixed depth in the (minified) pixi-viewport
// tree, so we walk the whole viewport subtree and collect every finite,
// in-world (x,y). The pass criteria then identifies the player as the sprite
// whose position is NOT in the step-0 baseline (i.e. the one that moved).
//
// dialog and hud are kept SEPARATE so the pass gate can require real
// showText() output without being spoofed by the always-on HUD hint.
//
// All reads are best-effort; failures return null/empty fields instead of
// throwing so a missing PIXI node or closed dialog never aborts the smoke loop.
async function captureGameState(page) {
  const fallback = {
    allPositions: [],
    dialog: null,
    hud: null,
    stageAlive: false,
    dialogDebug: null,
  };
  try {
    return await page.evaluate(
      (selectors) => {
        const result = {
          allPositions: [],
          dialog: null,
          hud: null,
          stageAlive: false,
          dialogDebug: null,
        };
        try {
          const stage = window.__PIXI_STAGE__;
          if (stage) {
            result.stageAlive = true;
            const findViewport = (node) => {
              if (!node) return null;
              if (node.viewport) return node;
              for (const child of node.children || []) {
                const found = findViewport(child);
                if (found) return found;
              }
              return null;
            };
            const vp = findViewport(stage);
            if (vp) {
              const seen = new WeakSet();
              const walk = (node, depth) => {
                if (!node || depth > 12 || seen.has(node)) return;
                seen.add(node);
                const x = Number(node.x);
                const y = Number(node.y);
                // Collect any finite in-world coord (skip 0,0 anchors and obvious
                // screen-space values); the player lives alongside map tiles and
                // other sprites, all of which are < 4000 in this map.
                if (
                  Number.isFinite(x) &&
                  Number.isFinite(y) &&
                  (x !== 0 || y !== 0) &&
                  Math.abs(x) < 4000 &&
                  Math.abs(y) < 4000
                ) {
                  result.allPositions.push(`${Math.round(x)},${Math.round(y)}`);
                }
                if (node.children) {
                  for (const child of node.children) walk(child, depth + 1);
                }
              };
              walk(vp, 0);
            }
          }
        } catch {}
        try {
          if (selectors.dialog) {
            const dialogEl = document.querySelector(selectors.dialog);
            if (dialogEl) {
              const t = dialogEl.textContent?.trim();
              if (t) result.dialog = t.slice(0, 400);
            }
          }
        } catch {}
        try {
          if (selectors.hud) {
            const hintEl = document.querySelector(selectors.hud);
            if (hintEl) {
              const t = hintEl.textContent?.trim();
              if (t) result.hud = t.slice(0, 400);
            }
          }
        } catch {}
        try {
          // Debug: enumerate every RPG-JS dialog-related DOM node so we can
          // verify which selector actually contains showText() output. This
          // is small and only populated when such nodes exist.
          const dialogNodes = document.querySelectorAll(
            "[class*='rpg-ui-dialog'], [class*='rpg-dialog'], #rpg-ui-dialog, [class*='notification']",
          );
          if (dialogNodes.length > 0) {
            result.dialogDebug = Array.from(dialogNodes)
              .slice(0, 8)
              .map((el) => ({
                cls: el.className,
                text: (el.textContent || "").trim().slice(0, 80),
              }));
          }
        } catch {}
        return result;
      },
      {
        dialog: GAME_SMOKE_CONTRACT.dialogSelector,
        hud: GAME_SMOKE_CONTRACT.hudSelector,
      },
    );
  } catch {
    // Playwright-level failure (page navigated, context destroyed, evaluation
    // rejected, etc.). The inner try/catch blocks above only handle errors
    // thrown inside the browser context; this outer guard keeps the smoke
    // loop alive and returns the documented empty default.
    return fallback;
  }
}

async function askVlmForAction({ screenshot, index, steps, fallback }) {
  if (!config.vlmBaseUrl || !config.vlmModel) return fallback;
  const prompt = `You are testing Open Pixel, an RPG-JS pixel quest game. Goal: verify real game flow, not DOM. Use one action only. Find menu/start/dialogue/player movement/quest/nodes. Return strict JSON: {"type":"key","key":"ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Space|Enter|Escape","note":"short reason"} or {"type":"click","x":640,"y":400,"note":"short reason"}. Step ${index}. Recent actions: ${JSON.stringify(steps.slice(-5).map((s) => s.action))}`;
  const body = {
    model: config.vlmModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${screenshot.toString("base64")}`,
            },
          },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 1000,
    stream: false,
  };
  try {
    const response = await fetch(
      `${config.vlmBaseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${config.vlmApiKey}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok)
      return { ...fallback, note: `vlm http ${response.status}; fallback` };
    const json = await response.json();
    const text = json.choices?.[0]?.message?.content || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ...fallback, note: "vlm non-json; fallback" };
    const action = validateAction(JSON.parse(match[0]));
    if (action) return action;
    return { ...fallback, note: "vlm invalid action; fallback" };
  } catch (error) {
    return { ...fallback, note: `vlm error ${error.message}; fallback` };
  }
  return fallback;
}

function validateAction(action) {
  if (!action || typeof action !== "object") return null;
  if (action.type === "wait")
    return { type: "wait", note: action.note || "wait" };
  if (action.type === "key") {
    const allowed = new Set([
      "ArrowDown",
      "ArrowUp",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Enter",
      "Escape",
    ]);
    return allowed.has(action.key)
      ? { type: "key", key: action.key, note: action.note || "vlm key" }
      : null;
  }
  if (action.type === "click") {
    return Number.isFinite(action.x) && Number.isFinite(action.y)
      ? {
          type: "click",
          x: action.x,
          y: action.y,
          note: action.note || "vlm click",
        }
      : null;
  }
  return null;
}

function toMarkdown(report) {
  return `# AI Game Smoke Report\n\n- passed: ${report.passed}\n- reason: ${report.reason}\n- mode: ${report.mode}\n- url: ${report.url}\n- steps: ${report.steps.length}\n- pageErrors: ${report.pageErrors.length}\n- failedRequests: ${report.failedRequests.length}\n- artifacts: ${report.artifacts}\n`;
}

function findChromiumExecutable() {
  for (const path of [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ]) {
    if (path && existsSync(path)) return path;
  }
  return undefined;
}

async function startPreview() {
  const child = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--host",
      GAME_SMOKE_CONTRACT.preview.host,
      "--port",
      String(GAME_SMOKE_CONTRACT.preview.port),
    ],
    {
      cwd: GAME_SMOKE_CONTRACT.preview.cwd,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`vite preview exited early:\n${output}`);
    try {
      const response = await fetch(getGamePreviewUrl());
      if (response.ok) return child;
    } catch {}
    await sleep(100);
  }
  child.kill("SIGTERM");
  throw new Error(`vite preview did not start:\n${output}`);
}

function stopPreview(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function numberEnv(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

function parsePos(value) {
  if (!value) return null;
  const [xs, ys] = value.split(",");
  const x = Number(xs);
  const y = Number(ys);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
