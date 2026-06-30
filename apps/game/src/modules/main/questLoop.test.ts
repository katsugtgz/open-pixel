import { describe, expect, it } from "vitest";
import {
  decideGuideAction,
  decideVillageNodeAction,
  QUEST_VARIABLES,
  VILLAGE_COMPLETION_REWARD,
  VILLAGE_NODE_REWARD,
} from "./questLoop";

describe("Cozy Resource-Village Loop", () => {
  it("starts guest progress through the AI Guide", () => {
    expect(
      decideGuideAction({
        started: false,
        done: false,
        nodesRestored: 0,
      }),
    ).toEqual({
      kind: "start-or-progress",
      setStarted: true,
      text: "Village restoration: activate 3 village nodes. Press Space near each glowing node. Off-chain progress: 0/3",
    });
  });

  it("restores one village node for off-chain points", () => {
    expect(
      decideVillageNodeAction({
        started: true,
        done: false,
        nodesRestored: 1,
        nodeCollected: false,
      }),
    ).toEqual({
      kind: "restore-node",
      nodesRestored: 2,
      markCollected: true,
      rewardPoints: VILLAGE_NODE_REWARD,
      notification: {
        message: "Village node restored · 2/3",
        sound: "collect",
        type: "info",
      },
      text: "Village node restored. Off-chain progress: 2/3. +10 points.",
    });
  });

  it("completes village restoration after three nodes", () => {
    expect(
      decideGuideAction({
        started: true,
        done: false,
        nodesRestored: 3,
      }),
    ).toEqual({
      kind: "complete",
      setDone: true,
      rewardPoints: VILLAGE_COMPLETION_REWARD,
      notification: {
        message: "Village restored · +100 points",
        sound: "quest-complete",
        type: "info",
      },
      text: "Village restoration complete! +100 off-chain progress points. Go back web page claim badge.",
    });
  });

  it("keeps quest variables behind the public module constants", () => {
    expect(QUEST_VARIABLES).toEqual({
      nodesRestored: "open_pixel_shards",
      started: "open_pixel_quest_started",
      done: "open_pixel_quest_done",
    });
  });
});
