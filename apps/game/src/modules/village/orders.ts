// W1.3 stub — implementation lands in W3.1.
import type { ItemId } from "./inventory";

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

export const VILLAGE_ORDERS: Order[] = []; // populated in W3.1

export function canFulfill(
  inventory: Readonly<Record<ItemId, number>>,
  orderId: string,
): boolean {
  throw new Error("W1.3 stub: canFulfill");
}

export function fulfillOrder(orderId: string): FulfillmentResult {
  throw new Error("W1.3 stub: fulfillOrder");
}
