import { describe, expect, it } from "vitest";
import { MAP_ROLES, SIMPLEMAP_ID, VILLAGE_NODE_ROLES } from "./layoutRoles";

describe("Layout Grammar map roles", () => {
  it("names the player spawn and AI Guide on simplemap", () => {
    expect(MAP_ROLES.playerSpawn).toMatchObject({
      id: "player-spawn",
      map: SIMPLEMAP_ID,
      x: 376,
      y: 217,
    });
    expect(MAP_ROLES.aiGuide).toMatchObject({
      id: "ai-guide",
      map: SIMPLEMAP_ID,
      x: 384,
      y: 352,
    });
  });

  it("publishes exactly three village node roles", () => {
    expect(VILLAGE_NODE_ROLES.map((role) => role.id)).toEqual([
      "shard-1",
      "shard-2",
      "shard-3",
    ]);
    expect(new Set(VILLAGE_NODE_ROLES.map((role) => role.map))).toEqual(
      new Set([SIMPLEMAP_ID]),
    );
  });
});
