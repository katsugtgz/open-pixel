// W3.1 - OrderBoard event factory (workstations layer, kind=board).
//
// Each call returns a fresh EventDefinition bound to one Tiled board object via
// its `orderId` property. RPG-JS v5 does not auto-flow Tiled custom properties
// into EventDefinitions (W2.2 workaround), so the map adapter reads `orderId`
// and passes it through OrderBoardFactory props.
//
// Interaction model (W0.1 §5, free actions):
//   Space on the board  -> inspect: shows the order, its requirements, the
//                          player's current counts, and whether it is
//                          fulfillable.
//   If fulfillable      -> fulfill: consumes the required items, awards
//                          order.rewardPoints off-chain points, plays the
//                          quest-complete cue, and emits the completion
//                          payload through the proof bridge.
//
// All truth (counts, points, requirements) lives in orders.ts/inventory.ts;
// this factory only projects it into dialogs and notifications.
import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import { canFulfill, findOrder, fulfillOrder } from "../orders";
import { createInventory, type ItemId } from "../inventory";
import { emitCompletion } from "../proof-bridge";

export interface OrderBoardProps {
  id: string;
  orderId: string;
}

/**
 * Render a requirement line as "2× popberry (have: 3)" for the inspect dialog.
 * Reads the player's current count so the board always shows live numbers.
 */
function requirementLine(item: string, qty: number, have: number): string {
  const marker = have >= qty ? "✓" : "✗";
  return `${marker} ${qty}× ${item} (have: ${have})`;
}

/**
 * Build an invisible hitbox event for the village order board. The board
 * visuals are tile art placed in W2.1; this event only carries the
 * interaction logic, so it intentionally sets no graphic.
 */
export function OrderBoardFactory(props: OrderBoardProps): EventDefinition {
  const boardId = props.id;
  const orderId = props.orderId;
  return {
    name: boardId,
    async onAction(player: RpgPlayer) {
      const order = findOrder(orderId);
      if (!order) {
        await player.showText("No orders available at this board.");
        return;
      }

      const inv = createInventory(player);
      const snap = inv.snapshot();
      const snapshot = snap as Readonly<Record<ItemId, number>>;
      const ready = canFulfill(snapshot, orderId);

      const reqText = Object.entries(order.requires)
        .map(([item, qty]) =>
          requirementLine(item, qty as number, snap[item as ItemId] ?? 0),
        )
        .join("\n");

      if (!ready) {
        await player.showText(
          [
            `Order: ${order.label}`,
            `Reward: +${order.rewardPoints} pts`,
            "",
            "Requires:",
            reqText,
            "",
            "Not enough resources yet. Gather more!",
          ].join("\n"),
        );
        return;
      }

      const result = fulfillOrder(player, orderId);
      if (result.ok) {
        await player.showNotification(
          `Order fulfilled: ${order.label}! +${result.pointsEarned} pts`,
          { type: "info", sound: "quest-complete" },
        );
        // Bridge the completion payload to the (in-game) client socket. The
        // cross-app sync to the web claim page happens via Supabase upsert in
        // the W1.2 claim flow; see proof-bridge.ts for the limitation note.
        emitCompletion(player);
        return;
      }

      // Defensive: canFulfill was true but fulfillOrder returned not-ok. This
      // should not happen under the current single-threaded model, but we show
      // the reason rather than swallow it (W0.1 §7: no silent failures).
      await player.showText(
        `Could not fulfill ${order.label}: ${result.reason ?? "unknown error"}`,
      );
    },
  };
}
