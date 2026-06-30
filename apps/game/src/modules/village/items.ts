// W1.4 - Village resource-loop item database.
//
// Defines the four off-chain resource items consumed by the village loop:
// Wave 2.2 crop/tree/mine events grant these via `player.addItem(id, n)`, and
// Wave 3.1 orders/inventory read them back. The classes are registered
// server-side through `provideServerModules([{ database: { ... } }])` in
// apps/game/src/server.ts; the ids below MUST match the `ItemId` union in
// ./inventory.ts (single source of truth for the village inventory shape).
//
// Locked product line (non-negotiable): every item has price 0. These are
// off-chain resource counters only. They are never sold, never tokenized, and
// never touch approvals, swaps, permits, or contract calls - see
// docs/agents/resource-village-deterministic-packet.md §5.
//
// API note: @rpgjs/database v4.3 exports a single `Item` decorator factory.
// All ItemOptions fields are optional (id, name, description, price, ...). The
// W1.4 brief mentioned `icon`; it is NOT part of ItemOptions in this version,
// so it is omitted. Icons are a client spritesheet concern, not a server
// database concern.
//
// Implementation note: items are registered via imperative `Item(options)(Cls)`
// calls rather than `@Item` decorator syntax. The two are semantically
// identical (the decorator is sugar over the same `merge` function in
// @rpgjs/database/src/common.ts), but the imperative form avoids experimental-
// decorator syntax in the `vite.config.ts` import chain: Vite 8 on Node 26
// loads the config via native type-stripping, which does not transform
// experimental decorators and would raise `SyntaxError: Invalid or unexpected
// token` on `@Item`.
import { Item } from "@rpgjs/database";

export class Popberry {}
export class PopberrySeeds {}
export class WhittlewoodLog {}
export class OchruxMatrix {}

// Apply the Item decorator imperatively. `Item(options)` returns the `merge`
// decorator; invoking it on the class mutates static + prototype metadata
// identically to `@Item(options) class X {}`. See
// node_modules/@rpgjs/database/src/common.ts `merge`.
Item({
  id: "popberry",
  name: "Popberry",
  description: "A ripe berry harvested from a farm plot.",
  price: 0,
})(Popberry);

Item({
  id: "popberry_seeds",
  name: "Popberry Seeds",
  description: "Plant on an empty farm plot to grow a Popberry.",
  price: 0,
})(PopberrySeeds);

Item({
  id: "whittlewood_log",
  name: "Whittlewood Log",
  description: "Gathered by chopping a tree with an axe.",
  price: 0,
})(WhittlewoodLog);

Item({
  id: "ochrux_matrix",
  name: "Ochrux Matrix",
  description: "Mined from a rock node with a pickaxe.",
  price: 0,
})(OchruxMatrix);
