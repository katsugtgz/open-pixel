<p align="center">
  <img src="assets/open-pixel-logo.svg" alt="Open Pixel" width="128" height="128" />
</p>

<h1 align="center">Open Pixel</h1>

<p align="center">
  <strong>Guest-first cozy Web3 pixel RPG — no token economy, no real RMT, optional safe wallet proof.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#repository-layout">Repository layout</a> ·
  <a href="docs/SECURITY_MODEL.md">Security model</a> ·
  <a href="docs/VISUAL_STYLE.md">Visual style</a> ·
  <a href="docs/ROADMAP.md">Roadmap</a>
</p>

---

## What Is Open Pixel?

Open Pixel is a cozy browser RPG prototype inspired by social pixel worlds like Pixels.xyz. Players enter as guests, perform resource-village actions, fulfill a small board/workstation request, earn off-chain progress, and can optionally create a safe wallet proof.

The project is intentionally **not** a token economy. There is no staking, no swaps, no NFT marketplace, and no play-to-earn financial loop. The Web3 layer is limited to an optional readable wallet signature that proves completion.

## Demo

> Demo GIF/video slot. Add final resource-village gameplay capture before submission.

<p align="center">
  <a href="https://example.com/open-pixel-demo.mp4">
    <img src="assets/open-pixel-demo.gif" alt="Open Pixel animated demo" width="760" />
  </a>
</p>

## How It Works

- Browser-based pixel RPG resource-village loop.
- Guest-first onboarding: no wallet required to play.
- RPG-JS world actions: farm, chop, mine, craft, or prepare.
- Optional wallet proof via readable `personal_sign` message only.
- Supabase-backed leaderboard/proof storage using free tier.

```text
Guest player
-> enters RPG-JS game
-> performs resource actions
-> fulfills village order
-> receives Game Completion Receipt
-> claims Guest Badge
-> optionally signs readable Wallet Proof
-> appears on leaderboard
```

### Wallet Proof

Wallet proof is deliberately narrow:

- No transaction.
- No gas.
- No contract call.
- No token approval.
- No NFT approval.
- No swap.
- No permit.
- No `setApprovalForAll`.
- Only readable `personal_sign` message.

Example message:

```text
Open Pixel Proof

I completed Quest #1 with 130 off-chain points.

Domain: openpixel.app
Wallet: 0x...
Quest Run: run_...
Nonce: ...
Issued At: ...
Expiration Time: ...

This signature only proves quest completion.
It does not approve tokens, NFTs, swaps, transfers, or transactions.
```

## Quick Start

```bash
npm install
npm run build
```

Run the game:

```bash
npm run dev:game
```

Run the web app:

```bash
cp .env.example .env
npm run dev:web
```

Supabase setup:

```bash
# In Supabase SQL editor, paste and run supabase/schema.sql
```

Then set:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GAME_URL=/game
```

> Never expose a Supabase `service_role` key in the browser. This repo only expects an anon/publishable key on the frontend.

## Repository Layout

```text
open-pixel/
apps/
  game/      # RPG-JS game: map, resource actions, completion loop
  web/       # React/Vite claim page, wallet proof, leaderboard shell
packages/
  shared/    # proof message helpers + shared types
supabase/    # schema and RLS policies
docs/        # design, security, roadmap, contributor docs
assets/      # README/logo/demo media
```

## Tech Stack

- **RPG-JS** — game world, map, resource events, player variables.
- **React + Vite** — landing page, claim page, wallet proof UX.
- **Supabase** — free-tier persistence for players, quest runs, proofs, leaderboard.
- **Browser wallet provider API** — optional `personal_sign` proof flow; no tx library required.
- **Husky + lint-staged + Prettier** — basic repo hygiene.

## Design Choices

Open Pixel is scoped as a contest demo first:

- Fun resource-village loop before financial mechanics.
- Off-chain progress before tokens.
- Guest account before wallet.
- Wallet proof before on-chain transactions.
- Readable signatures before opaque typed-data signing.

See [`docs/DESIGN.md`](docs/DESIGN.md) for the current product direction.

## Documentation & Community

- Docs: [`docs/`](docs/)
- Security model: [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)
- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
- Discord: coming soon
- Hackathon page: coming soon

## License

MIT. See [`LICENSE`](LICENSE).
