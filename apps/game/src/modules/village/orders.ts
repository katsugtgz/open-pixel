// W3.1 - Village order board: order definitions, fulfillment check, and payout.
//
// Owns the off-chain order catalogue the player fulfills at the Task Board
// (Infinifunnel-style): each order lists resources gathered from the world
// (crops/wood/crystal) and pays off-chain points on completion. Per W0.1 §5
// every action is free and points are the only reward currency.
//
// Single source of truth split:
//   - state.ts::pointsFromCompletion("fulfill") === 25 is the DEFAULT order
//     value. order_01 keeps that default; order_02 overrides to 40 to show
//     per-order tuning (packet §5 "+order_value (default 25)").
//   - VILLAGE_POINTS_KEY mirrors the "village_points" variable used by the
//     crop/tree/mine event factories so payout lands in the same counter.
//
// canFulfill is pure (takes a snapshot) so it is unit-testable without a player;
// fulfillOrder mutates the player through the inventory adapter and the points
// variable, then returns a FulfillmentResult the caller can show in a dialog.
import type { RpgPlayer } from "@rpgjs/server";
import { createInventory, type InventoryShape, type ItemId } from "./inventory";

/** Player variable holding the total off-chain village points. */
export const VILLAGE_POINTS_KEY = "village_points";

export interface Order {
  id: string;
  label: string;
  requires: Partial<Record<ItemId, number>>;
  rewardPoints: number;
}

export interface FulfillmentResult {
  ok: boolean;
  reason?: string;
  pointsEarned: number;
}

/**
 * The hackathon order catalogue. Two orders exercise both single-resource and
 * multi-resource fulfillment; ids match the Tiled `orderId` property on the
 * workstations layer (board_orders -> order_01).
 */
export const VILLAGE_ORDERS: Order[] = [
  {
    id: "order_01",
    label: "Berry Basket",
    requires: { popberry: 2 },
    rewardPoints: 25,
  },
  {
    id: "order_02",
    label: "Builder's Kit",
    requires: { whittlewood_log: 2, ochrux_matrix: 1 },
    rewardPoints: 40,
  },
];

/** Look up an order by id. Returns undefined for unknown ids. */
export function findOrder(orderId: string): Order | undefined {
  return VILLAGE_ORDERS.find((o) => o.id === orderId);
}

/**
 * Pure fulfillment check against a resource snapshot. Returns true iff every
 * required resource meets or exceeds its required quantity. Used by the HUD
 * adapter (read-only) and the order board event before mutating the player.
 */
export function canFulfill(
  snapshot: Readonly<Record<ItemId, number>>,
  orderId: string,
): boolean {
  const order = findOrder(orderId);
  if (!order) return false;
  return Object.entries(order.requires).every(
    ([item, qty]) => (snapshot[item as ItemId] ?? 0) >= (qty as number),
  );
}

/**
 * Attempt to fulfill `orderId` against the player's current inventory.
 *
 * On success: consumes the required items, adds `order.rewardPoints` to the
 * `village_points` player variable, and returns `{ ok: true, pointsEarned }`.
 * On failure: returns `{ ok: false, reason, pointsEarned: 0 }` and mutates
 * nothing. Consume is all-or-nothing - the canFulfill guard runs first so we
 * never partially drain the inventory.
 */
export function fulfillOrder(
  player: RpgPlayer,
  orderId: string,
): FulfillmentResult {
  const order = findOrder(orderId);
  if (!order) {
    return { ok: false, reason: "Unknown order", pointsEarned: 0 };
  }

  const inv = createInventory(player);
  const snapshot = inv.snapshot();
  if (!canFulfill(snapshot as Readonly<Record<ItemId, number>>, orderId)) {
    return { ok: false, reason: "Not enough resources", pointsEarned: 0 };
  }

  for (const [item, qty] of Object.entries(order.requires)) {
    inv.consume(item as ItemId, qty as number);
  }

  const current = player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0;
  player.setVariable(VILLAGE_POINTS_KEY, current + order.rewardPoints);

  return { ok: true, pointsEarned: order.rewardPoints };
}

/**
 * Read-only helper for projections (HUD adapter, proof bridge): returns the
 * order the board object points at, or null. Kept here so the order catalogue
 * has one accessor surface.
 */
export function describeOrder(
  snapshot: Readonly<Record<ItemId, number>>,
  orderId: string,
): { label: string; rewardPoints: number; fulfillable: boolean } | null {
  const order = findOrder(orderId);
  if (!order) return null;
  return {
    label: order.label,
    rewardPoints: order.rewardPoints,
    fulfillable: canFulfill(
      snapshot as Readonly<Record<ItemId, number>>,
      orderId,
    ),
  };
}

/** Convenience: the snapshot shape required to render resources in the HUD/proof. */
export type { InventoryShape };
