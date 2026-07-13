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
      text: "Village restoration: activate 3 village nodes. Press Space near a glowing node. Off-chain progress: 0/3",
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
        message: "Village node restored 2/3.",
        sound: "collect",
        type: "info",
      },
      text: "Village node restored. Off-chain progress: 2/3. +10 points.",
    });
  });

  it("completes the loop after three village nodes", () => {
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
        message: "Village restored! +100 off-chain points.",
        sound: "quest-complete",
        type: "info",
      },
      text: "Cozy Resource-Village Loop complete. You restored all 3 village nodes and earned +100 off-chain points.",
    });
  });

  it("sends guests to the AI Guide before any node when the quest is not started", () => {
    expect(
      decideVillageNodeAction({
        started: false,
        done: false,
        nodesRestored: 0,
      }),
    ).toEqual({
      kind: "needs-guide",
      text: "Talk to the AI Guide first. The village loop starts there.",
    });
  });

  it("does not re-award points for an already-restored node", () => {
    const decision = decideVillageNodeAction({
      started: true,
      done: false,
      nodesRestored: 1,
      nodeCollected: true,
    });
    expect(decision).toEqual({
      kind: "already-restored",
      text: "This village node is already glowing. Find another node.",
    });
    expect(decision).not.toHaveProperty("rewardPoints");
  });

  it("treats every node as restored once the quest is complete", () => {
    expect(
      decideVillageNodeAction({
        started: true,
        done: true,
        nodesRestored: 3,
        nodeCollected: false,
      }),
    ).toEqual({
      kind: "already-complete",
      text: "This village node is already restored.",
    });
  });

  it("stays complete when talking to the AI Guide after finishing", () => {
    expect(
      decideGuideAction({
        started: true,
        done: true,
        nodesRestored: 3,
      }),
    ).toEqual({
      kind: "already-complete",
      text: "Village restoration complete. Return to the web page to claim your guest badge or add an optional wallet proof.",
    });
  });

  it("keeps RPG-JS variable keys behind the module interface", () => {
    expect(QUEST_VARIABLES).toEqual({
      nodesRestored: "open_pixel_shards",
      started: "open_pixel_quest_started",
      done: "open_pixel_quest_done",
    });
  });
});
