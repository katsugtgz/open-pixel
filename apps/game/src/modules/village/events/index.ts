// Barrel re-exports for the village event factories.
//
// The map adapter imports all factories from this single path. W3.1 adds the
// OrderBoardFactory used by the workstations layer (kind=board).
export { CropPlotFactory } from "./crop-plot";
export type { CropPlotProps } from "./crop-plot";
export { VILLAGE_POINTS_KEY } from "../state";

export { TreeFactory, TREE_HITS_TO_FELL } from "./tree";
export type { TreeNodeProps } from "./tree";

export { MineFactory } from "./mine";
export type { MineNodeProps } from "./mine";

export { OrderBoardFactory } from "./order-board";
export type { OrderBoardProps } from "./order-board";
