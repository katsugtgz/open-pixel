// W2.2 - Village resource-loop state machine.
//
// Pure functions only: no side effects, no @rpgjs imports. These own the
// off-chain truth for plot and node transitions per
// docs/agents/resource-village-deterministic-packet.md §5. The event factories
// in ./events/*.ts call these to compute the next state and the points awarded;
// they do not encode the lifecycle themselves, so the rules stay testable and
// single-sourced here.
//
// Hackathon lifecycle (locked by W0.1 §5 - instant growth, free actions):
//
//   plot:  empty -> planted -> watered -> ready -> empty  (cycle restarts)
//          'grown' is kept in the union for forward-compat but the hackathon
//          slice collapses watered -> ready on the first harvest intent.
//   node:  ready -> depleted  (no regen for the vertical slice)
//
// Points table (off-chain, stored in player variable 'village_points'):
//   plant=0  water=0  harvest=+5  chop=+3  mine=+4  fulfill=+25

export type ResourceKind = "crop" | "wood" | "stone" | "crystal" | "none";

export type PlotState =
  | "empty"
  | "planted"
  | "watered"
  | "grown"
  | "ready"
  | "depleted";

export type NodeState = "ready" | "depleted" | "active";

/** Action verb carried by a farm plot interaction. */
export type PlotAction = "plant" | "water" | "harvest";

/** Action verb carried by a resource node interaction. */
export type NodeAction = "chop" | "mine";

/** All completion actions that can award off-chain points. */
export type CompletionAction =
  | "plant"
  | "water"
  | "harvest"
  | "chop"
  | "mine"
  | "fulfill";

export interface ResourceState {
  kind: ResourceKind;
  plot?: PlotState;
  node?: NodeState;
  updatedAt: number;
}

/**
 * Advance a farm plot to its next lifecycle state.
 *
 * Returns `current` unchanged for any illegal (state, action) pair so callers
 * can treat a no-op as "nothing to do here yet". The hackathon slice collapses
 * growth: a watered plot becomes `ready` when the player returns to harvest.
 */
export function advancePlotState(
  current: PlotState,
  action: PlotAction,
): PlotState {
  if (action === "plant" && current === "empty") return "planted";
  if (action === "water" && current === "planted") return "watered";
  if (action === "harvest" && current === "watered") return "ready";
  if (action === "harvest" && current === "ready") return "empty";
  if (action === "harvest" && current === "grown") return "empty";
  return current;
}

/**
 * Transition a tree or mine node.
 *
 * Both chop and mine deplete a `ready` node. `depleted` is terminal for the
 * hackathon slice (no regen) - any further action leaves it depleted.
 */
export function transitionNodeState(
  current: NodeState,
  action: NodeAction,
): NodeState {
  if (current === "ready" && (action === "chop" || action === "mine")) {
    return "depleted";
  }
  return current;
}

/**
 * Off-chain points awarded when a completion action fires (W0.1 §5 table).
 *
 * `plant` and `water` are setup steps and award 0. `fulfill` defaults to +25
 * and is exercised by the W3.1 order board; it lives here so the formula has a
 * single source of truth.
 */
export function pointsFromCompletion(action: CompletionAction): number {
  switch (action) {
    case "plant":
      return 0;
    case "water":
      return 0;
    case "harvest":
      return 5;
    case "chop":
      return 3;
    case "mine":
      return 4;
    case "fulfill":
      return 25;
    default:
      return 0;
  }
}
