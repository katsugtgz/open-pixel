# Open Pixel Context

## Language

**Open Pixel**:
guest-first cozy pixel RPG about resource work, village progress, and optional safe wallet proof.

**Cozy Resource-Village Loop**:
gameplay identity where players do calm resource actions, help a small village, and see immediate visible progress.

**Resource Action**:
calm in-world action such as planting, watering, chopping, mining, crafting, or preparing a drink that changes visible state and moves village progress.

**Mechanic Grammar**:
reusable interaction language of the game: players recognize actionable objects, choose tools, receive feedback, track progress, and turn effort into rewards.

**Game Completion Receipt**:
game-issued completion signal proving a player finished required in-world objectives.
_Avoid_: self-declared completion, demo claim.

**Guest Badge**:
off-chain achievement awarded after a **Game Completion Receipt**.
_Avoid_: wallet badge, token reward.

**Wallet Proof**:
optional readable wallet signature linking a wallet to a completed **Guest Badge** without approving or sending anything.
_Avoid_: transaction, approval, mint, permit.

**Layout Grammar**:
high-level spatial pattern that makes a play space understandable at a glance.

**Layout Composition**:
specific spatial arrangement, silhouettes, colors, prop placement, and screen framing of another game scene.

## Relationships

- **Open Pixel** uses **Cozy Resource-Village Loop** as its target game identity.
- **Open Pixel** may borrow **Mechanic Grammar** and **Layout Grammar** from cozy pixel resource games.
- **Open Pixel** must not copy exact **Layout Composition** from Pixels or any other specific game.
- **Cozy Resource-Village Loop** depends on visible object states, immediate feedback, and lightweight objectives.
- **Resource Action** produces progress toward a **Game Completion Receipt**.
- **Guest Badge** depends on a **Game Completion Receipt**.
- **Wallet Proof** depends on a completed **Guest Badge** and remains optional.

## Example Dialogue

**Dev:** "Can the claim page mint a Guest Badge when the player types a name?"

> **Domain expert:** "No. The player needs a Game Completion Receipt from the game first. Wallet Proof is optional after that."

## Flagged Ambiguities

- "Pixel Shard quest" describes the legacy/current implementation, not the target product loop.
- "AI Guide quest" is helper/tutorial language only; the **AI Guide** must not gate the main **Cozy Resource-Village Loop**.
- "Proof" means **Wallet Proof** only when a wallet signs; in-game completion should be called **Game Completion Receipt**.
