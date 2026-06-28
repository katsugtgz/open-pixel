// W1.3 stub — implementations land in W2.2/W3.1.
export type ResourceKind = "crop" | "wood" | "stone" | "crystal" | "none";
export type PlotState =
  | "empty"
  | "planted"
  | "watered"
  | "grown"
  | "ready"
  | "depleted";
export type NodeState = "ready" | "depleted";

export interface ResourceState {
  kind: ResourceKind;
  plot?: PlotState;
  node?: NodeState;
  updatedAt: number;
}

export function advancePlotState(current: PlotState): PlotState {
  throw new Error("W1.3 stub: advancePlotState");
}

export function transitionNodeState(current: NodeState): NodeState {
  throw new Error("W1.3 stub: transitionNodeState");
}

export function pointsFromCompletion(
  action: "plant" | "water" | "harvest" | "chop" | "mine" | "fulfill",
): number {
  throw new Error("W1.3 stub: pointsFromCompletion");
}
