import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDir = resolve("public/generated");
const url = process.env.NINEROUTER_URL;
const key = process.env.NINEROUTER_KEY;

const voiceModel =
  process.env.NINEROUTER_TTS_MODEL ||
  "el/eleven_multilingual_v2/hpp4J3VqNfWAUOO0d1Us";
const narration = [
  "Open Pixel is a cozy Web3 pixel RPG built for a hackathon demo.",
  "You start as a guest, open the browser game, and move through the farm village with simple WASD controls.",
  "The Cozy Resource-Village Loop lets you plant, water, and harvest crops, chop trees, mine rocks, and fulfill village orders to earn off-chain points and claim a badge.",
  "The Web3 layer stays optional. The proof is a readable personal sign receipt only: no token, no gas, no approvals, no swaps, and no permit.",
  "Open Pixel keeps the game playable first, with proof as a clear safety receipt after the village loop.",
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
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid NINEROUTER_URL: ${url}`);
  }
  await mkdir(outputDir, { recursive: true });
}

function truncate(text, max = 200) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function looksLikeAudio(bytes) {
  return (
    bytes.subarray(0, 3).toString() === "ID3" ||
    bytes.subarray(0, 4).toString() === "RIFF" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}

async function generateVoiceover() {
  const response = await fetchWithTimeout(`${url}/v1/audio/speech`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model: voiceModel, input: narration }),
  });

  if (!response.ok)
    throw new Error(
      `TTS failed: ${response.status} ${truncate(await response.text())}`,
    );
  const audio = Buffer.from(await response.arrayBuffer());
  if (!looksLikeAudio(audio))
    throw new Error("TTS did not return MP3/WAV audio");
  await writeFile(resolve(outputDir, "voiceover.mp3"), audio);
}

await requireConfig();
await generateVoiceover();
console.log("Generated public/generated/voiceover.mp3");
