#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

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

    steps.push({ index, action, hash, screenshot: screenshotPath, canvas });

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
    if (uniqueHashes < 3)
      reason = "low visual progress: fewer than 3 unique frames";
    else {
      passed = true;
      reason = "AI game smoke flow passed";
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
  if (action.type === "key") return page.keyboard.press(action.key);
  if (action.type === "text") return page.keyboard.type(action.text || "");
  if (action.type === "click") return page.mouse.click(action.x, action.y);
  throw new Error(`unsupported action: ${JSON.stringify(action)}`);
}

async function askVlmForAction({ screenshot, index, steps, fallback }) {
  if (!config.vlmBaseUrl || !config.vlmModel) return fallback;
  const prompt = `You are testing Open Pixel, an RPG-JS pixel quest game. Goal: verify real game flow, not DOM. Use one action only. Find menu/start/dialogue/player movement/quest/shards. Return strict JSON: {"type":"key","key":"ArrowDown|ArrowUp|ArrowLeft|ArrowRight|Space|Enter|Escape","note":"short reason"} or {"type":"click","x":640,"y":400,"note":"short reason"}. Step ${index}. Recent actions: ${JSON.stringify(steps.slice(-5).map((s) => s.action))}`;
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
    max_tokens: 120,
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
