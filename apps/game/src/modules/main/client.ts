import { defineModule } from "@rpgjs/common";
import type {
  AbstractWebsocket,
  RpgClient,
  RpgClientEngineHooks,
} from "@rpgjs/client";

interface QuestRunPayload {
  guestId: string;
  displayName: string;
  questId: string;
  points: number;
  shards: number;
  completedAt: string;
}

const STORAGE_KEY = "open_pixel_quest_run_v1";

// Dynamic import is required, not stylistic: @rpgjs/client's main entry
// eagerly loads canvasengine, which references `window` at module top-level.
// Vite evaluates apps/game/src/server.ts (-> index.ts -> here) in Node when
// loading vite.config.ts, so a static import would crash with
// `window is not defined`. onConnected only runs in the browser.
const engine: RpgClientEngineHooks = {
  async onConnected() {
    const { inject, WebSocketToken } = await import("@rpgjs/client");
    const socket = inject<AbstractWebsocket>(WebSocketToken);
    socket.on("open_pixel:quest_run", (payload: QuestRunPayload) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        // localStorage unavailable (private mode, quota, SSR); never throw
        console.warn("[open-pixel] failed to persist quest run", err);
      }
    });
  },
};

export default defineModule<RpgClient>({ engine });
