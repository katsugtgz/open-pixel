export type MapRole = {
  id: string;
  map: "simplemap";
  x: number;
  y: number;
};

export const SIMPLEMAP_ID = "simplemap";

export const MAP_ROLES = {
  playerSpawn: {
    id: "player-spawn",
    map: SIMPLEMAP_ID,
    x: 376,
    y: 217,
  },
  aiGuide: {
    id: "ai-guide",
    map: SIMPLEMAP_ID,
    x: 384,
    y: 352,
  },
  villageNodeOne: {
    id: "shard-1",
    map: SIMPLEMAP_ID,
    x: 176,
    y: 336,
  },
  villageNodeTwo: {
    id: "shard-2",
    map: SIMPLEMAP_ID,
    x: 624,
    y: 336,
  },
  villageNodeThree: {
    id: "shard-3",
    map: SIMPLEMAP_ID,
    x: 400,
    y: 528,
  },
} as const satisfies Record<string, MapRole>;

export const VILLAGE_NODE_ROLES = [
  MAP_ROLES.villageNodeOne,
  MAP_ROLES.villageNodeTwo,
  MAP_ROLES.villageNodeThree,
] as const;
