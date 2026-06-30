#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const MOVEMENT_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

const config = {
  url:
    process.env.AI_GAME_URL || process.argv[2] || "http://127.0.0.1:4173/game/",
  headless: process.env.AI_GAME_HEADLESS !== "false",
  maxSteps: numberEnv("AI_GAME_MAX_STEPS", 18),
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
  await page.waitForSelector("#rpg canvas", { timeout: 25_000 });
  await page.waitForTimeout(2_000);
  await page.keyboard.press("Tab").catch(() => {});

  let lastHash = "";
  let changedFrames = 0;
  let stableFrames = 0;
  let froze = false;
  const actions = initialActions();

  for (let index = 0; index < config.maxSteps; index += 1) {
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

    const canvas = await page.locator("#rpg canvas").boundingBox();
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
      : actions[index % actions.length];

    await executeAction(page, action);
    await sleep(config.stepDelayMs);

    steps.push({
      index,
      action,
      hash,
      screenshot: screenshotPath,
      canvas,
      gameState: gameState.allPositions,
      dialogText: gameState.dialog,
    });

    if (stableFrames >= 8) {
      froze = true;
      reason =
        "visual freeze/softlock: screenshot unchanged for 8 consecutive observed frames";
      break;
    }
  }

  if (froze) reason = reason;
  else if (pageErrors.length) reason = "page/console errors detected";
  else if (failedRequests.length) reason = "game asset requests failed";
  else if (steps.length < Math.min(4, config.maxSteps))
    reason = "agent loop stopped too early";
  else if (
    !steps.some((step) => step.canvas?.width > 200 && step.canvas?.height > 200)
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
    const parsePos = (p) => {
      if (!p) return null;
      const [xs, ys] = p.split(",");
      const x = Number(xs);
      const y = Number(ys);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    };
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
    const dialogs = steps.map((s) => s.dialogText).filter(Boolean);
    const questProgressed = dialogs.some((d) =>
      /\/3|quest complete|collected/i.test(d),
    );

    if (uniqueHashes < 3)
      reason = "low visual progress: fewer than 3 unique frames";
    else if (uniquePositions < 3)
      reason = `character did not move enough: only ${uniquePositions} unique sprite positions (need >= 3); screenshots changed but player stayed put`;
    else {
      passed = true;
      reason = `AI game smoke flow passed: ${uniqueHashes} unique frames, ${uniquePositions} unique sprite positions${
        questProgressed ? ", quest progressed" : ""
      }`;
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
  return [
    { type: "key", key: "ArrowDown", note: "move down" },
    { type: "key", key: "ArrowRight", note: "move right" },
    { type: "key", key: "ArrowUp", note: "move up" },
    { type: "key", key: "ArrowLeft", note: "move left" },
    { type: "key", key: "Space", note: "interact" },
    { type: "key", key: "Enter", note: "confirm/dialogue" },
    { type: "key", key: "ArrowRight", note: "explore" },
    { type: "key", key: "Space", note: "interact again" },
  ];
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
    const holdMs = MOVEMENT_KEYS.has(action.key)
      ? numberEnv("AI_GAME_MOVE_HOLD_MS", 700)
      : numberEnv("AI_GAME_ACTION_HOLD_MS", 200);
    await page.keyboard.down(action.key);
    await sleep(holdMs);
    await page.keyboard.up(action.key);
    return;
  }
  if (action.type === "text") return page.keyboard.type(action.text || "");
  if (action.type === "click") return page.mouse.click(action.x, action.y);
  throw new Error(`unsupported action: ${JSON.stringify(action)}`);
}

// Reads ground-truth gameplay state from the live page:
//   - all in-world sprite positions via the PIXI stage tree (window.__PIXI_STAGE__)
//   - current quest/dialog text via DOM (.rpg-ui-dialog-body if RPG-JS renders
//     dialog to DOM, or the .quest-hint HUD tracker as a fallback)
//
// The player sprite is not at a fixed depth in the (minified) pixi-viewport
// tree, so we walk the whole viewport subtree and collect every finite,
// in-world (x,y). The pass criteria then identifies the player as the sprite
// whose position is NOT in the step-0 baseline (i.e. the one that moved).
//
// Both reads are best-effort; failures return null/empty fields instead of
// throwing so a missing PIXI node or closed dialog never aborts the smoke loop.
async function captureGameState(page) {
  const fallback = { allPositions: [], dialog: null };
  try {
    return await page.evaluate(() => {
      const result = { allPositions: [], dialog: null };
      try {
        const stage = window.__PIXI_STAGE__;
        if (stage) {
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
        // RPG-JS dialog body (in-canvas DOM overlay) when present...
        const dialogEl = document.querySelector(".rpg-ui-dialog-body");
        // ...or the React-shell quest tracker that is always present.
        const hintEl = document.querySelector(".quest-hint");
        const texts = [];
        if (dialogEl) {
          const t = dialogEl.textContent?.trim();
          if (t) texts.push(t);
        }
        if (hintEl) {
          const t = hintEl.textContent?.trim();
          if (t) texts.push(t);
        }
        if (texts.length) result.dialog = texts.join(" | ").slice(0, 400);
      } catch {}
      return result;
    });
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

function isGameAssetUrl(value) {
  return (
    /\/(map|assets|spritesheets)\//.test(value) ||
    /\/(default-bundle|revoltfx-spritesheet)\.json(?:\?|$)/.test(value)
  );
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
    ["vite", "preview", "--host", "127.0.0.1", "--port", "4173"],
    {
      cwd: "apps/web",
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
      const response = await fetch("http://127.0.0.1:4173/game/");
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
