// W1.3 stub — implementation lands in W3.1.
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

export function createInventory(initial?: Partial<InventoryShape>): Inventory {
  throw new Error("W1.3 stub: createInventory");
}
