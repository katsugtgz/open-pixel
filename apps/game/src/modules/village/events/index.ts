// W2.2 - Barrel re-exports for the village event factories.
//
// The map adapter imports all factories from this single path. The order board
// factory (OrderBoardFactory) is intentionally absent - it lands in W3.1 with
// the orders/inventory work and must not be created here (see MUST NOT DO).
export { CropPlotFactory } from "./crop-plot";
export type { CropPlotProps } from "./crop-plot";
export { VILLAGE_POINTS_KEY } from "./crop-plot";

export { TreeFactory, TREE_HITS_TO_FELL } from "./tree";
export type { TreeNodeProps } from "./tree";

export { MineFactory } from "./mine";
export type { MineNodeProps } from "./mine";
