# Open Pixel Design

## Goal

Build a guest-first cozy pixel RPG where the main loop is resource work, village progress, and optional safe wallet proof. The game must be playable without a wallet and must not depend on token economy.

## Canonical Product Direction

- Public brand: **Open Pixel**.
- Internal mechanic name: **Cozy Resource-Village Loop**.
- Current target PRD: GitHub issue #15, "Replace legacy AI Guide quest with Cozy Resource-Village Loop".
- Deterministic implementation packet: GitHub issue #21 and `docs/agents/resource-village-deterministic-packet.md`.
- Legacy/current implementation: AI Guide plus three Pixel Shards/village nodes. This is not the target product loop.

## Locked Decisions

- Contest demo first.
- No token.
- No real-money trading.
- RPG-JS canvas remains the source of truth.
- Wallet proof lives outside the core game loop on the claim page.
- Guest play first; optional wallet link after completion.
- Supabase free-tier persistence for players, quest runs, wallet proofs, and leaderboard.

## Target Loop

```text
Enter as guest
-> move through RPG-JS village
-> perform resource actions: farm, chop, mine, craft or prepare
-> update visible inventory/task progress
-> fulfill one small board/workstation order
-> receive game completion receipt
-> claim off-chain guest badge
-> optionally sign readable wallet proof
-> continue playing
```

## Architecture Direction

```text
apps/game
  RPG-JS map/player/events
  resource actions
  inventory/resource counters
  task board or workstation fulfillment
  game completion receipt

apps/web
  landing page
  guest badge claim
  optional wallet proof
  security receipt
  leaderboard shell

packages/shared
  shared types
  proof message builder
  security receipt constants

supabase
  players
  quest_runs
  wallet_proofs
  leaderboard view
```

## Agent Rules

- Do not optimize the old three-shard loop as if it is the product.
- Do not make AI Guide dialogue the gate for core progress.
- Do not allow a claim page self-declared run to represent real completion.
- Do not count work complete without artifacts: command output, screenshots, and game-state evidence.

## Non-Goals

- Tokenomics.
- Marketplace.
- Staking.
- NFT approvals.
- On-chain inventory.
- Bot-resistant production economy.
- Large multiplayer scale.

## Future Branches

- More resource recipes and drink/crafting jobs.
- Persistent player profile.
- Multiplayer social hub.
- Cosmetic badges after security review.
- On-chain attestation after product validation.
- Stronger Supabase auth and server-side verification.
