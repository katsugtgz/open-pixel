# Domain Notes

Open Pixel is a guest-first RPG-JS pixel RPG prototype. It uses readable off-chain progress and optional Wallet Proof; it must not introduce token economy, real-money trading, approvals, transactions, staking, swaps, or marketplace mechanics.

## Canonical Language

Use the glossary in root `CONTEXT.md`:

- **Open Pixel**
- **Cozy Resource-Village Loop**
- **Resource Action**
- **Mechanic Grammar**
- **Game Completion Receipt**
- **Guest Badge**
- **Wallet Proof**
- **Layout Grammar**
- **Layout Composition**

## Source Order

When docs conflict, use this order:

1. `CONTEXT.md`
2. `docs/DESIGN.md`
3. GitHub issue #15
4. GitHub issue #21 and `docs/agents/resource-village-deterministic-packet.md`
5. Current app code

Current app code may lag product direction. In particular, AI Guide + three Pixel Shards/village nodes is legacy/current implementation, not the target product loop.

## Game Rules

Gameplay work must preserve the real RPG-JS canvas and improve in-engine map, events, assets, resource interactions, inventory/task progress, and fulfillment. Do not replace the game with DOM fallbacks.

Agents do not get credit for "looks done" claims. They need evidence: build/test output, screenshots, and game-state proof of resource action plus fulfillment.
