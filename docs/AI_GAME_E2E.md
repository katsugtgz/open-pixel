# AI Game E2E / Smoke Test

Open Pixel game QA must test the real RPG-JS canvas flow, not DOM mocks.

This harness runs an autonomous game-smoke agent:

```text
build web+game
-> start Vite preview
-> open real game page
-> observe screenshot
-> choose keyboard/mouse action
-> execute
-> detect crash/freeze/no-progress
-> write JSON report + screenshots
```

## Files

- `scripts/ai-game-smoke.mjs` — agent smoke runner.
- `artifacts/ai-game-smoke/` — local reports/screenshots.
- `docs/agents/resource-village-deterministic-packet.md` — target product QA contract.

## Local Usage

```bash
npm ci
npm run build:vercel
npm run test:game:ai
```

Default target:

```text
http://127.0.0.1:4173/game/
```

The script starts `vite preview` automatically unless `AI_GAME_URL` is set.

## Scripted Fallback Mode

Default mode uses deterministic smoke actions:

```text
ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Space, Enter, ...
```

This is CI-safe and has no external model dependency.

```bash
npm run test:game:ai
```

Baseline pass criteria:

- RPG-JS canvas appears.
- Canvas is not tiny or missing.
- Screenshots change after movement/interactions.
- Page console stays clean.
- RPG-JS asset requests succeed.
- Visual freeze/softlock pattern is absent.

Product pass criteria for the target **Cozy Resource-Village Loop**:

- First viewport reads as a resource village, not only an NPC quest room.
- Player can perform resource action without wallet connection.
- Smoke artifacts show resource/inventory/task progress, not only dialogue.
- Fulfillment or completion feedback is visible.
- No fake DOM replacement hides the RPG-JS canvas.

## VLM Autonomous Mode

Enable only when an OpenAI-compatible vision endpoint is available.

```bash
AI_GAME_VLM_ENABLED=1 \
AI_GAME_VLM_BASE_URL=http://ktzserver.tail3d7914.ts.net:20128/v1 \
AI_GAME_VLM_MODEL=<your-vision-model> \
AI_GAME_VLM_API_KEY=dummy \
npm run test:game:ai
```

Notes:

- `gemini/gemini-embedding-2-preview` is embeddings-only; not enough for screenshot decisions.
- Keep default scripted mode if endpoint latency/secrets are unstable.

## Agent Instruction

When gameplay, map, sprites, RPG-JS config, quest/resource events, NPCs, input, or build output changes, run:

```bash
npm run build:vercel
npm run test:game:render
npm run test:game:ai
```

Do not claim completion from command success alone. Include:

- `artifacts/ai-game-smoke/summary.md`
- `artifacts/ai-game-smoke/report.json`
- relevant `artifacts/ai-game-smoke/step-*.png` screenshots
- resource-loop screenshots when the change targets the **Cozy Resource-Village Loop**

If AI smoke fails:

1. Open `artifacts/ai-game-smoke/summary.md`.
2. Inspect last `step-*.png`.
3. Check `report.json` fields: `pageErrors`, `failedRequests`, `reason`.
4. Fix the RPG-JS pipeline/asset/input/event bug.
5. Re-run `npm run test:game:ai`.

Old AI Guide + three-pickup evidence is not enough for target resource-loop work.

Do not bypass failure by hiding/replacing the RPG-JS canvas with DOM fallback.
