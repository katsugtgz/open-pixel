# Open Pixel Agent Workspace

Dedicated Hermes/Discord profile: `open-pixel`.

## Purpose

Handle only Open Pixel work:

- Repo/code: `/home/katsu/open-pixel`
- GitHub: `https://github.com/katsugtgz/open-pixel`
- Zero Cup submission/demo assets
- RPG-JS game QA/fixes
- React/Vite landing + claim + wallet proof
- Supabase schema/RLS/checks for project `lthfxdgdyxkbeuohazbf`
- Vercel deploy/debug for this app
- Discord bot routing/mentions for this project

Anything unrelated belongs in another Hermes profile.

## Profile files

```text
~/.hermes/profiles/open-pixel/
  config.yaml
  SOUL.md
  memories/MEMORY.md
  memories/USER.md
  skills/software-development/open-pixel/SKILL.md
```

## Discord route copy

Use this for bot/channel description:

> Open Pixel agent: repo, game, deploy, Supabase, wallet proof, demo QA.

Recommended channel/alias names:

- `open-pixel`
- `openpixel`
- `pixel-game`

## Agent boot

```bash
cd /home/katsu/open-pixel
pwd
git status --short --branch
git remote -v
git log -1 --oneline
```

Then read:

- `AGENTS.md`
- `docs/VISUAL_STYLE.md` for UI
- `docs/SECURITY_MODEL.md` + `SECURITY.md` for wallet/proof
- `docs/AI_GAME_E2E.md` + `docs/AI_GAME_AGENT_WORKFLOW.md` for game QA

## Non-negotiables

- Guest-first.
- Wallet optional.
- `personal_sign` readable proof only.
- No token, no RMT, no swap, no permit, no approvals, no tx.
- Never expose `service_role` in browser.
- Never fake/replace/hide the RPG-JS canvas.

## Default verification

```bash
npm run build
npm run typecheck
npm run test
npm run format:check
npm run db:check
npm audit --omit=dev
```

Game/render changes:

```bash
npm run build:vercel
npm run test:game:render
npm run test:game:ai
```
