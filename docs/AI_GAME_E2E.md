# AI Game E2E / Smoke Test

Open Pixel game QA must test the real RPG-JS canvas flow, not DOM mocks.

This harness runs an autonomous game-smoke agent:

```text
build web+game -> start Vite preview -> open real game page -> observe screenshot -> choose keyboard/mouse action -> execute -> detect crash/freeze/no-progress -> write JSON report + screenshots
```

## Files

- `scripts/ai-game-smoke.mjs` — agent smoke runner.
- `artifacts/ai-game-smoke/` — local reports/screenshots.

## Local usage

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

## Scripted fallback mode

Default mode uses deterministic smoke actions:

```text
ArrowDown, ArrowRight, ArrowUp, ArrowLeft, Space, Enter, ...
```

This is CI-safe and has no external model dependency.

```bash
npm run test:game:ai
```

Pass criteria:

- RPG-JS canvas appears.
- canvas is not tiny/missing.
- screenshots change after movement/interactions.
- page console stays clean.
- RPG-JS asset requests succeed.
- visual freeze/softlock pattern is absent.

## VLM autonomous mode

Enable only when an OpenAI-compatible vision endpoint is available.

```bash
AI_GAME_VLM_ENABLED=1 \
# local Tailscale example only; replace with your own endpoint
AI_GAME_VLM_BASE_URL=http://ktzserver.tail3d7914.ts.net:20128/v1 \
AI_GAME_VLM_MODEL=<your-vision-model> \
AI_GAME_VLM_API_KEY=dummy \
npm run test:game:ai
```

Notes:

- `gemini/gemini-embedding-2-preview` is embeddings-only; not enough for screenshot decisions.
- This runner needs a **vision chat model** for VLM mode, e.g. `gpt-4o-mini`, `gemini-2.0-flash`, or `claude-3-5-sonnet-latest` via an OpenAI-compatible proxy.
- The Tailscale URL above is local-dev only; external users need their own OpenAI-compatible endpoint and real API key. `dummy` is only valid for local endpoints that ignore auth.
- If VLM fails/non-JSON, runner falls back to scripted action for that step.

Expected VLM response format:

```json
{ "type": "key", "key": "ArrowRight", "note": "move toward NPC" }
```

Allowed key examples:

```text
ArrowDown ArrowUp ArrowLeft ArrowRight Space Enter Escape
```

Click action:

```json
{ "type": "click", "x": 640, "y": 400, "note": "focus game canvas" }
```

## CI behavior

GitHub Actions does not run this harness until `.github/workflows/ci.yml` includes `npm run test:game:ai`. Local validation command:

```bash
npm run test:game:ai
```

If wired into CI, upload artifacts from:

```text
artifacts/ai-game-smoke/report.json
artifacts/ai-game-smoke/summary.md
artifacts/ai-game-smoke/step-*.png
```

Use these to debug what the agent saw.

## Optional: PR-only VLM mode

Add repository secrets:

```text
AI_GAME_VLM_BASE_URL
AI_GAME_VLM_MODEL
AI_GAME_VLM_API_KEY
```

Then set workflow env:

```yaml
env:
  AI_GAME_VLM_ENABLED: "1"
  AI_GAME_VLM_BASE_URL: ${{ secrets.AI_GAME_VLM_BASE_URL }}
  AI_GAME_VLM_MODEL: ${{ secrets.AI_GAME_VLM_MODEL }}
  AI_GAME_VLM_API_KEY: ${{ secrets.AI_GAME_VLM_API_KEY }}
```

Keep default scripted mode if endpoint latency/secrets are unstable.

## Agent/developer instruction

When gameplay, map, sprites, RPG-JS config, quest events, NPCs, shards, input, or build output changes, run:

```bash
npm run build:vercel
npm run test:game:render
npm run test:game:ai
```

If AI smoke fails:

1. Open `artifacts/ai-game-smoke/summary.md`.
2. Inspect last `step-*.png`.
3. Check `report.json` fields: `pageErrors`, `failedRequests`, `reason`.
4. Fix RPG-JS pipeline/asset/input/event bug.
5. Re-run `npm run test:game:ai`.

Do not bypass failure by hiding/replacing RPG-JS canvas with DOM fallback.
