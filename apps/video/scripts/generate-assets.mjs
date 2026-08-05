import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve("public/generated");
const url = process.env.NINEROUTER_URL;
const key = process.env.NINEROUTER_KEY;

const voiceModel =
  process.env.NINEROUTER_TTS_MODEL ||
  "el/eleven_multilingual_v2/hpp4J3VqNfWAUOO0d1Us";
const imageModel = process.env.NINEROUTER_IMAGE_MODEL || "cx/gpt-5.5-image";

const narration = [
  "Open Pixel is a cozy AI native Web3 pixel quest game built for a hackathon demo.",
  "You start as a guest, open the browser game, and move through the field with simple WASD controls.",
  "The AI Guide gives one focused quest: gather three Pixel Shards, earn off chain points, and claim a badge.",
  "The Web3 layer stays optional. The proof is a readable personal sign receipt only: no token, no gas, no approvals, no swaps, and no permit.",
  "Open Pixel keeps the game playable first, with proof as a clear safety receipt after the quest.",
].join(" ");

const imagePrompt = [
  "Open Pixel promo splash for a cozy browser pixel RPG hackathon demo.",
  "Bright pixel-art field, cheerful AI guide NPC, small player avatar, glowing lime shards, badge receipt UI.",
  "No logos from other games, no copyrighted characters, original assets only.",
  "High clarity, 16:9 composition, readable game trailer key art.",
].join(" ");

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function requireConfig() {
  if (!url || !key) {
    throw new Error(
      "Set NINEROUTER_URL and NINEROUTER_KEY before running assets:generate.",
    );
  }
  await mkdir(outputDir, { recursive: true });
}

async function generateVoiceover() {
  const response = await fetch(`${url}/v1/audio/speech`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: voiceModel, input: narration }),
  });

  if (!response.ok)
    throw new Error(`TTS failed: ${response.status} ${await response.text()}`);
  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.byteLength < 1024)
    throw new Error(`TTS returned ${audio.byteLength} bytes`);
  await writeFile(resolve(outputDir, "voiceover.mp3"), audio);
}

function extractImageUrl(text) {
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line));

  for (const row of rows.reverse()) {
    if (row === "[DONE]") continue;
    try {
      const parsed = JSON.parse(row);
      const url = parsed.data?.[0]?.url || parsed.url || parsed.output?.[0];
      if (typeof url === "string") return url;
      const b64 = parsed.data?.[0]?.b64_json || parsed.b64_json;
      if (typeof b64 === "string") return `data:image/png;base64,${b64}`;
    } catch {
      // Continue scanning SSE chunks.
    }
  }

  throw new Error("Image response did not include a URL or base64 payload.");
}

async function fetchImageBytes(imageUrl) {
  if (imageUrl.startsWith("data:")) {
    const [, base64] = imageUrl.split(",");
    return Buffer.from(base64, "base64");
  }

  const response = await fetch(imageUrl);
  if (!response.ok)
    throw new Error(`Image download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function generateSplash() {
  const response = await fetch(`${url}/v1/images/generations`, {
    method: "POST",
    headers: headers({ Accept: "text/event-stream" }),
    body: JSON.stringify({
      model: imageModel,
      prompt: imagePrompt,
      n: 1,
      size: "1792x1024",
      quality: "auto",
      background: "auto",
      image_detail: "high",
      output_format: "png",
    }),
  });

  if (!response.ok)
    throw new Error(
      `Image failed: ${response.status} ${await response.text()}`,
    );
  const imageBytes = await fetchImageBytes(
    extractImageUrl(await response.text()),
  );
  if (imageBytes.byteLength < 1024)
    throw new Error(`Image returned ${imageBytes.byteLength} bytes`);
  await writeFile(resolve(outputDir, "splash.png"), imageBytes);
}

await requireConfig();
await Promise.all([generateVoiceover(), generateSplash()]);
console.log(
  "Generated public/generated/voiceover.mp3 and public/generated/splash.png",
);
