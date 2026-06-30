# Open Pixel design

## Goal

Build an AI-native Web3 pixel quest game for a hackathon demo. The core experience must be playable without a wallet and must not depend on a token economy.

## Locked decisions

- Contest demo first.
- No token.
- No real-money trading.
- Quest + resource gathering gameplay.
- RPG-JS foundation.
- Phaser fallback only if RPG-JS blocks wallet/shell/deploy for more than one day.
- Wallet proof lives outside the game on a claim page.
- Guest ID first; optional wallet link.
- Supabase free tier for persistence.
- Deterministic Cozy Resource-Village Loop for MVP.

## MVP loop

```text
Enter as guest
  → enter farm village
  → plant, water, harvest crops
  → chop trees, mine rocks
  → fulfill village orders
  → earn off-chain points
  → claim guest badge
  → optionally sign wallet proof
  → appear on leaderboard
```

## Architecture

```text
apps/game
  RPG-JS map/player/events
  village resource loop
  CropPlot, Tree, Mine, OrderBoard events
  off-chain village points

apps/web
  landing page
  guest claim
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

## Non-goals

- Tokenomics.
- Marketplace.
- Staking.
- NFT approvals.
- On-chain inventory.
- Bot-resistant production economy.
- Large multiplayer scale.

## Future branches

- Real LLM quest generation.
- Multiplayer social hub.
- Cosmetic NFT badges.
- On-chain attestation after security review.
- Stronger Supabase auth and server-side verification.
