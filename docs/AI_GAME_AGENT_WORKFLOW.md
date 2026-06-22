# Full Autonomous AI Game Tester

This is the **real AI game tester** for Open Pixel. It is separate from the fast CI smoke test.

## What it does

```text
Xvfb desktop
→ real Chromium window
→ Vite preview /game
→ screenshot whole desktop
→ send screenshot to vision chat model
→ model returns JSON action
→ pyautogui presses key/clicks
→ repeat
→ save report/screenshots/bugs
```

It tests the real RPG-JS canvas like a human player. No DOM selectors. No Playwright control loop.

## Files

```text
scripts/run-ai-game-e2e.sh          # shell workflow: build, Xvfb, deps, runner
scripts/ai-game-agent-runner.py     # autonomous VLM + pyautogui runner
requirements-ai-game-e2e.txt        # Python deps
artifacts/ai-game-agent/            # report/screenshots/bugs
```

## Required model

Needs a **vision-capable chat model** through OpenAI-compatible `/v1/chat/completions`.

Good examples:

```text
gpt-4o-mini
gpt-4.1-mini
gemini-2.5-flash
qwen2.5-vl
llava
```

Not enough:

```text
gemini/gemini-embedding-2-preview
```

Reason:

```text
embedding model cannot inspect screenshots
```

## Local usage

```bash
cd /home/katsu/open-pixel

AI_GAME_VLM_BASE_URL=http://ktzserver.tail3d7914.ts.net:20128/v1 \
AI_GAME_VLM_MODEL=<vision-chat-model> \
AI_GAME_VLM_API_KEY=*** \
npm run test:game:agent
```

If endpoint has no key:

```bash
AI_GAME_VLM_API_KEY=dummy
```

Fast rerun without rebuild:

```bash
AI_GAME_SKIP_BUILD=1 \
AI_GAME_VLM_BASE_URL=http://ktzserver.tail3d7914.ts.net:20128/v1 \
AI_GAME_VLM_MODEL=<vision-chat-model> \
AI_GAME_VLM_API_KEY=dummy \
npm run test:game:agent
```

## Output

```text
artifacts/ai-game-agent/report.json
artifacts/ai-game-agent/bugs.json
artifacts/ai-game-agent/summary.md
artifacts/ai-game-agent/screenshots/step-*.png
```

## Pass/fail behavior

Pass if:

```text
VLM reaches done
or exploration completes without fatal bug
```

Fail if:

```text
runner error
VLM endpoint unusable
visual freeze/softlock
high severity bug
agent stops early
```

## Difference vs smoke CI

Fast CI smoke:

```bash
npm run test:game:ai
```

- deterministic fallback actions
- no external AI required
- good PR gate
- catches blank/crash/freeze/no visual progress

Full AI tester:

```bash
npm run test:game:agent
```

- VLM decides actions from screenshots
- uses pyautogui over desktop
- explores gameplay more autonomously
- best for local/release/manual QA

## Optional GitHub Actions usage

Only enable if you have reliable secrets and a vision endpoint.

Repository secrets:

```text
AI_GAME_VLM_BASE_URL
AI_GAME_VLM_MODEL
AI_GAME_VLM_API_KEY
```

Workflow env example:

```yaml
env:
  AI_GAME_VLM_BASE_URL: ${{ secrets.AI_GAME_VLM_BASE_URL }}
  AI_GAME_VLM_MODEL: ${{ secrets.AI_GAME_VLM_MODEL }}
  AI_GAME_VLM_API_KEY: ${{ secrets.AI_GAME_VLM_API_KEY }}
```

Then add step:

```yaml
- name: Full autonomous AI game tester
  run: npm run test:game:agent
```

Recommendation:

```text
Keep full AI tester manual or scheduled first.
Keep deterministic smoke as required PR gate.
```

## Debug

Open:

```text
artifacts/ai-game-agent/summary.md
artifacts/ai-game-agent/bugs.json
latest screenshots in artifacts/ai-game-agent/screenshots/
```

Common failures:

```text
Missing AI_GAME_VLM_BASE_URL / MODEL → set env
VLM HTTP 400 → model does not support image_url input
No Chromium found → install chromium/google-chrome
No display → install/run Xvfb
Non-JSON VLM response → choose better model or lower temperature
```
