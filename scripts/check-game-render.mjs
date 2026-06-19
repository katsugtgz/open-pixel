import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { inflateSync } from "node:zlib";

const providedUrl = process.argv[2];
const url = providedUrl || "http://127.0.0.1:4173/game/";
const preview = providedUrl ? null : await startPreview();

const pageErrors = [];
const failedRequests = [];
let browser;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    const responseUrl = response.url();
    if (response.status() >= 400 && isGameAssetUrl(responseUrl)) {
      failedRequests.push(`${response.status()} ${responseUrl}`);
    }
  });

  page.on("requestfailed", (request) => {
    const requestUrl = request.url();
    if (isGameAssetUrl(requestUrl)) {
      failedRequests.push(
        `request failed ${requestUrl}: ${request.failure()?.errorText || "unknown"}`,
      );
    }
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForSelector("#rpg canvas", { timeout: 20_000 });
  await page.waitForTimeout(2_000);

  const canvasBox = await page.locator("#rpg canvas").boundingBox();
  const screenshot = await page.screenshot({ fullPage: false });
  const pixels = decodePng(screenshot);
  const result = sampleNonBlackPixels(pixels, canvasBox);

  if (pageErrors.length || failedRequests.length || !result.ok) {
    throw new Error(
      JSON.stringify({ pageErrors, failedRequests, canvas: result }, null, 2),
    );
  }

  console.log(`Game render check passed: ${url}`);
} finally {
  await browser?.close();
  preview?.kill("SIGTERM");
}

function isGameAssetUrl(value) {
  return (
    /\/(map|assets|spritesheets)\//.test(value) ||
    /\/(default-bundle|revoltfx-spritesheet)\.json(?:\?|$)/.test(value)
  );
}

async function startPreview() {
  const child = spawn(
    "npx",
    ["vite", "preview", "--host", "127.0.0.1", "--port", "4173"],
    { cwd: "apps/web", stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`vite preview exited early:\n${output}`);
    }
    try {
      const response = await fetch("http://127.0.0.1:4173/game/");
      if (response.ok) return child;
    } catch {
      // Keep polling until Vite binds the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill("SIGTERM");
  throw new Error(`vite preview did not start:\n${output}`);
}

function decodePng(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error("invalid PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      chunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`unsupported PNG color type ${colorType}`);
  }
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(chunks));
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let source = 0;
  let target = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source++];
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[source++];
      const left = x >= bytesPerPixel ? rgba[target - bytesPerPixel] : 0;
      const up = y > 0 ? rgba[target - stride] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel ? rgba[target - stride - bytesPerPixel] : 0;
      rgba[target++] = (raw + unfilter(filter, left, up, upLeft)) & 255;
    }
  }
  return { width, height, rgba, bytesPerPixel };
}

function unfilter(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter !== 4) throw new Error(`unsupported PNG filter ${filter}`);
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  return pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
}

function sampleNonBlackPixels(pixels, box) {
  if (!box) return { ok: false, reason: "missing canvas box" };
  let nonBlackPixels = 0;
  const xStart = Math.max(0, Math.floor(box.x));
  const yStart = Math.max(0, Math.floor(box.y));
  const xEnd = Math.min(pixels.width, Math.ceil(box.x + box.width));
  const yEnd = Math.min(pixels.height, Math.ceil(box.y + box.height));
  for (let y = yStart; y < yEnd; y += 4) {
    for (let x = xStart; x < xEnd; x += 4) {
      const index = (y * pixels.width + x) * pixels.bytesPerPixel;
      const brightness =
        pixels.rgba[index] + pixels.rgba[index + 1] + pixels.rgba[index + 2];
      const alpha = pixels.bytesPerPixel === 4 ? pixels.rgba[index + 3] : 255;
      if (alpha > 0 && brightness > 12) nonBlackPixels += 1;
    }
  }
  return {
    ok: nonBlackPixels > 500,
    reason: `sampled non-black pixels: ${nonBlackPixels}`,
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}
