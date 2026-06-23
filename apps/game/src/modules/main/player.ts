import { RpgPlayer, type RpgPlayerHooks, Components } from "@rpgjs/server";

const FALLBACK_NAME = "Hero";
const NAME_MAX_LENGTH = 16;
// Allow only ASCII letters, digits, space, underscore, hyphen.
// Everything else (angle brackets, quotes, etc.) is stripped to defeat XSS
// payloads like `<img src=x onerror=alert(1)>` and `<script>...</script>`.
const NAME_FORBIDDEN_CHARS = /[^A-Za-z0-9 _-]/g;

/**
 * Sanitize a raw guest name into a safe display string.
 *
 * Rules:
 *   1. Non-strings (undefined, null, numbers, objects) fall back to "Hero".
 *   2. Any character outside [A-Za-z0-9 space _ -] is removed.
 *   3. Leading/trailing whitespace is trimmed.
 *   4. Result is clamped to 16 characters.
 *   5. Empty result after cleaning falls back to "Hero".
 *
 * The returned string is safe to assign directly to `player.name` (RPG-JS
 * renders it as plain text above the sprite). It must NEVER be inserted via
 * innerHTML/insertAdjacentHTML — those APIs are not used here.
 *
 * @param raw - Untrusted input (URL param, localStorage value, socket payload).
 * @returns Safe display name, never empty.
 */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return FALLBACK_NAME;
  const cleaned = raw
    .replace(NAME_FORBIDDEN_CHARS, "")
    .trim()
    .slice(0, NAME_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : FALLBACK_NAME;
}

/**
 * Resolve the player's display name from server-visible sources.
 *
 * IMPORTANT: `player.ts` runs on the SERVER (Node.js). Browser-only APIs
 * (`window.location.search`, `localStorage`) are NOT available here. The
 * `?name=` URL parameter and `localStorage.open_pixel_name` therefore require
 * a small client-side bridge (e.g. `socket.emit("setDisplayName", { name })`)
 * to forward the value to the server. That bridge is out of scope for this
 * task because only `player.ts` may be modified.
 *
 * Until the client bridge ships, we read the name from server-visible sources:
 *   - `process.env.OPEN_PIXEL_NAME` (useful for tests / headless QA)
 *   - `globalThis.openPixelName` (escape hatch for embedded/test runtimes)
 *
 * The `onConnected` hook also registers a `setDisplayName` listener so a
 * future client change can apply the sanitized name without touching
 * `player.ts` again.
 */
function resolveDisplayName(): string {
  const candidates: unknown[] = [
    typeof process !== "undefined" && process.env
      ? process.env.OPEN_PIXEL_NAME
      : undefined,
    (globalThis as { openPixelName?: unknown }).openPixelName,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return sanitizeName(candidate);
    }
  }
  return FALLBACK_NAME;
}

export const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    player.changeMap("simplemap", {
      x: 376,
      y: 217,
    });
    player.name = resolveDisplayName();
    player.setGraphic("hero");

    // Optional client bridge: a future client-side change can call
    // `socket.emit("setDisplayName", { name: ... })` to forward the
    // `?name=` URL param or `localStorage.open_pixel_name` value. The
    // server always re-sanitizes before applying it.
    player.on?.("setDisplayName", (data: unknown) => {
      const next =
        data && typeof data === "object" && "name" in data
          ? sanitizeName((data as { name: unknown }).name)
          : FALLBACK_NAME;
      player.name = next;
    });
  },
  onInput(player: RpgPlayer, { action }) {
    if (action == "escape") {
      player.callMainMenu();
    }
  },
};
