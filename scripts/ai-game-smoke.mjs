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
      hint: gameState.hint,
      domOverride: gameState.domOverride,
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
  else if (steps.some((step) => step.domOverride)) {
    const overrideStep = steps.find((step) => step.domOverride);
    reason = `DOM overlay replaces RPG-JS canvas: ${overrideStep.domOverride} (canvas integrity violation — do not hide the real WebGL/Pixi scene behind a DOM mock)`;
  } else if (steps.length >= Math.min(8, config.maxSteps)) {
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
    // Resource-village loop evidence. The game emits showNotification /
    // showText for each resource action ("Harvested Popberry", "Tree felled",
    // "Mined Ochrux Matrix", "Order fulfilled"). We group the observed DYNAMIC
    // text (dialog body + notification overlay — never the static .quest-hint,
    // which always lists the verbs) into distinct action categories so the
    // smoke can verify >=2 distinct resource actions and flag an order
    // fulfillment signal when the player reaches the Task Board.
    const observedText = steps
      .map((s) => s.dialogText)
      .filter(Boolean)
      .join(" | ")
      .toLowerCase();
    const RESOURCE_SIGNAL = {
      crop: /popberry|harvested|\bplot\b|seeded|watered|ripe|\bplant\b/i,
      tree: /whittlewood|tree fell|\bchop\b/i,
      mine: /ochrux|\bmined\b|depleted/i,
      order: /order fulfill|fulfilled|could not fulfill|reward:/i,
    };
    const hitCategories = Object.keys(RESOURCE_SIGNAL).filter((key) =>
      RESOURCE_SIGNAL[key].test(observedText),
    );
    const resourceActionsDetected = hitCategories.length;
    const fulfillmentDetected = RESOURCE_SIGNAL.order.test(observedText);

    if (uniqueHashes < 3)
      reason = "low visual progress: fewer than 3 unique frames";
    else if (uniquePositions < 3)
      reason = `character did not move enough: only ${uniquePositions} unique sprite positions (need >= 3); screenshots changed but player stayed put`;
    else {
      passed = true;
      const parts = [
        `${uniqueHashes} unique frames`,
        `${uniquePositions} unique sprite positions`,
      ];
      if (resourceActionsDetected >= 2) {
        parts.push(
          `resource-loop verified: ${hitCategories.join("/")}${
            fulfillmentDetected ? " (+order fulfillment signal)" : ""
          }`,
        );
      } else if (resourceActionsDetected === 1) {
        parts.push(
          `partial resource-loop evidence: ${hitCategories[0]} only (need >=2 distinct actions for full verification)`,
        );
      } else {
        // Informational, not a failure: headless Chrome cannot render the
        // WebGL/Pixi canvas (documented limitation), so notifications may not
        // fire even though the player moved. Visual + positional progress still
        // prove the RPG-JS scene booted and accepted input.
        parts.push(
          "no resource-action text captured this run (player did not land on a plot/tree/mine; see docs/AI_GAME_E2E.md for the headless WebGL limit)",
        );
      }
      reason = `Cozy resource-village smoke passed: ${parts.join(", ")}`;
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
  // Resource-village loop: walk the map and press Space after each move so the
  // player has several chances to land adjacent to a crop plot, tree, or mine
  // and trigger a plant/water/harvest/chop/mine notification. Enter advances
  // any open dialog and confirms Task Board interactions.
  return [
    { type: "key", key: "ArrowDown", note: "walk south toward plots" },
    { type: "key", key: "Space", note: "interact: plant/water/harvest crop" },
    { type: "key", key: "ArrowRight", note: "explore east (trees/mines)" },
    { type: "key", key: "Space", note: "interact: chop tree or mine rock" },
    { type: "key", key: "ArrowUp", note: "explore north" },
    { type: "key", key: "Space", note: "interact with nearby node" },
    { type: "key", key: "ArrowLeft", note: "explore west" },
    { type: "key", key: "Space", note: "interact with plot/tree/mine" },
    { type: "key", key: "ArrowRight", note: "explore toward Task Board" },
    { type: "key", key: "Space", note: "interact: open Task Board / fulfill order" },
    { type: "key", key: "Enter", note: "advance dialog or confirm order" },
    { type: "key", key: "Space", note: "interact again before run ends" },
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
//   - dynamic gameplay text via DOM: .rpg-ui-dialog-body (showText) PLUS the
//     .rpg-ui-notification / .rpg-ui-toast overlay (showNotification), where
//     resource-loop actions emit their evidence ("Harvested Popberry",
//     "Mined Ochrux Matrix", "Order fulfilled", ...).
//   - the static .quest-hint controls reference, captured separately so it can
//     NEVER satisfy resource-loop assertions (it always lists the verbs).
//   - domOverride: flags a large <div>/<section>/<main> whose class contains
//     "game"/"mock"/"fallback"/"fake" laid over the #rpg canvas. This guards
//     the RPG-JS integrity invariant (no DOM/HTML mock game may hide the real
//     WebGL/Pixi scene).
//
// The player sprite is not at a fixed depth in the (minified) pixi-viewport
// tree, so we walk the whole viewport subtree and collect every finite,
// in-world (x,y). The pass criteria then identifies the player as the sprite
// whose position is NOT in the step-0 baseline (i.e. the one that moved).
//
// All reads are best-effort; failures return null/empty fields instead of
// throwing so a missing PIXI node or closed dialog never aborts the smoke loop.
async function captureGameState(page) {
  const fallback = { allPositions: [], dialog: null, hint: null, domOverride: null };
  try {
    return await page.evaluate(() => {
      const result = { allPositions: [], dialog: null, hint: null, domOverride: null };
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
        // DYNAMIC text only: RPG-JS dialog body (showText) + notification/toast
        // overlay (showNotification). Resource-loop actions emit their evidence
        // here, so both must be collected to verify real gameplay progress.
        const dialogEl = document.querySelector(".rpg-ui-dialog-body");
        const notifEls = document.querySelectorAll(
          ".rpg-ui-notification, .rpg-ui-notification-message, .rpg-ui-toast, .rpg-ui-toast-message, .rpg-ui-notifications",
        );
        const texts = [];
        if (dialogEl) {
          const t = dialogEl.textContent?.trim();
          if (t) texts.push(t);
        }
        notifEls.forEach((el) => {
          const t = el.textContent?.trim();
          if (t) texts.push(t);
        });
        if (texts.length) result.dialog = texts.join(" | ").slice(0, 800);
      } catch {}
      try {
        // STATIC controls hint, kept separate so its always-present verbs
        // ("Plant/Water/Harvest ... Chop ... Mine") can never be mistaken for
        // real resource-loop evidence.
        const hintEl = document.querySelector(".quest-hint");
        if (hintEl) {
          const t = hintEl.textContent?.trim();
          if (t) result.hint = t.slice(0, 400);
        }
      } catch {}
      try {
        // DOM-replace detection: a large block element whose class contains
        // "mock"/"fallback"/"fake"/"game[-board]"/"dom-game" overlapping the
        // #rpg canvas is treated as a DOM mock covering the real RPG-JS scene.
        const canvasEl = document.querySelector("#rpg canvas");
        if (canvasEl) {
          const cRect = canvasEl.getBoundingClientRect();
          const canvasArea = Math.max(1, cRect.width * cRect.height);
          const isSuspiciousToken = (token) =>
            /mock|fallback|fake/i.test(token) ||
            /^game(-|board|$)/i.test(token) ||
            /^dom[-_]?game/i.test(token);
          const nodes = document.querySelectorAll(
            "body div, body section, body main",
          );
          for (const el of nodes) {
            if (el === canvasEl) continue;
            if (el.contains(canvasEl) || canvasEl.contains(el)) continue;
            if (el.closest(".control-help")) continue;
            const raw = el.className;
            const cls = typeof raw === "string" ? raw : "";
            const hit = cls
              .split(/\s+/)
              .some((token) => token && isSuspiciousToken(token));
            if (!hit) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 400 || r.height < 300) continue;
            const overlap =
              Math.max(
                0,
                Math.min(cRect.right, r.right) - Math.max(cRect.left, r.left),
              ) *
              Math.max(
                0,
                Math.min(cRect.bottom, r.bottom) - Math.max(cRect.top, r.top),
              );
            if (overlap / canvasArea > 0.5) {
              result.domOverride = `<${el.tagName.toLowerCase()} class="${cls.slice(0, 120)}"> covers ~${Math.round(
                (100 * overlap) / canvasArea,
              )}% of #rpg canvas`;
              break;
            }
          }
        }
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
  const prompt = `You are testing Open Pixel, a cozy RPG-JS resource-village game. Goal: verify real gameplay flow, not DOM. Use one action only. Walk to farm plots, trees, mine rocks, and the Task Board; press Space near each to plant/water/harvest crops, chop trees, mine rocks, and fulfill orders. Return strict JSON: {"type":"key","key":"ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Space|Enter|Escape","note":"short reason"} or {"type":"click","x":640,"y":400,"note":"short reason"}. Step ${index}. Recent actions: ${JSON.stringify(steps.slice(-5).map((s) => s.action))}`;
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
