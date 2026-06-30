#!/usr/bin/env node
import { chromium } from "playwright";

const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : "9223";
if (portIndex >= 0) args.splice(portIndex, 2);

const command = args[0];
if (!command) {
  console.error("Missing command");
  process.exit(2);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
try {
  const context = browser.contexts()[0];
  const page = context?.pages()[0];
  if (!page) throw new Error("No CDP page available");

  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .waitForLoadState("domcontentloaded", { timeout: 10_000 })
    .catch(() => {});

  if (command === "screenshot") {
    const out = args[1];
    if (!out) throw new Error("Missing screenshot path");
    await page.screenshot({ path: out, fullPage: false });
  } else if (command === "press") {
    const key = args[1] || "Space";
    await page.keyboard.press(key);
  } else if (command === "click") {
    const x = Number(args[1] || 640);
    const y = Number(args[2] || 400);
    await page.mouse.click(x, y);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} finally {
  await browser.close();
}
