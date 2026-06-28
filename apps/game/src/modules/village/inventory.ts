// W3.1 - Village inventory adapter over the RPG-JS v5 player item API.
//
// Single source of truth for "how many of each village resource the player has".
// The class wraps a real RpgPlayer and forwards add/count/consume to the engine
// item manager; snapshot() projects the four village resource ids into the
// InventoryShape consumed by orders, the HUD adapter, and the proof bridge.
//
// RPG-JS v5 API notes (verified against node_modules/@rpgjs/server):
//   - player.addItem(id, qty)             adds `qty` of item `id` (ItemManager)
//   - player.hasItem(id): boolean         true iff item is in inventory
//   - player.getItem(id): Item            returns the Item (or undefined at
//                                         runtime when missing; the TS signature
//                                         is non-undefined so we gate on
//                                         hasItem to stay type-safe without any
//                                         cast and avoid a runtime TypeError)
//   - Item.quantity(): number             signe signal read of the stack count
//   - player.removeItem(id, qty)          decrements the stack
//
// Locked product line (W0.1 §5): these are off-chain resource counters only.
// They have price 0, are never sold/tokenized, and never touch approvals/swaps.
import type { RpgPlayer } from "@rpgjs/server";

export type ItemId =
  | "popberry"
  | "popberry_seeds"
  | "whittlewood_log"
  | "ochrux_matrix";

export interface InventoryShape {
  popberry: number;
  popberry_seeds: number;
  whittlewood_log: number;
  ochrux_matrix: number;
}

export interface Inventory {
  add(item: ItemId, qty: number): void;
  count(item: ItemId): number;
  consume(item: ItemId, qty: number): boolean;
  snapshot(): Readonly<InventoryShape>;
}

/**
 * Inventory backed by a live RpgPlayer. Reads/writes go straight through the
 * RPG-JS v5 item manager so the engine stays the authority; this class only
 * narrows the surface to the four village resource ids.
 */
export class VillageInventory implements Inventory {
  private readonly player: RpgPlayer;

  constructor(player: RpgPlayer) {
    this.player = player;
  }

  add(item: ItemId, qty: number): void {
    this.player.addItem(item, qty);
  }

  count(item: ItemId): number {
    // getItem() returns undefined at runtime for missing items even though the
    // TS signature is non-undefined; hasItem() gates the read so we never call
    // quantity() on undefined.
    if (!this.player.hasItem(item)) return 0;
    return this.player.getItem(item).quantity();
  }

  consume(item: ItemId, qty: number): boolean {
    if (this.count(item) < qty) return false;
    this.player.removeItem(item, qty);
    return true;
  }

  snapshot(): Readonly<InventoryShape> {
    return {
      popberry: this.count("popberry"),
      popberry_seeds: this.count("popberry_seeds"),
      whittlewood_log: this.count("whittlewood_log"),
      ochrux_matrix: this.count("ochrux_matrix"),
    };
  }
}

/**
 * Build a VillageInventory over a live player. Callers (orders, HUD adapter,
 * proof bridge) pass the player in so there is one inventory per player, not a
 * detached copy of the counts.
 */
export function createInventory(player: RpgPlayer): Inventory {
  return new VillageInventory(player);
}
