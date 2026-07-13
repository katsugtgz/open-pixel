export const QUEST_VARIABLES = {
  nodesRestored: "open_pixel_shards",
  started: "open_pixel_quest_started",
  done: "open_pixel_quest_done",
} as const;

export const VILLAGE_NODE_TOTAL = 3;
export const VILLAGE_NODE_REWARD = 10;
export const VILLAGE_COMPLETION_REWARD = 100;

export type QuestSnapshot = {
  started: boolean;
  done: boolean;
  nodesRestored: number;
  nodeCollected?: boolean;
};

export type QuestNotification = {
  message: string;
  sound: "collect" | "quest-complete";
  type: "info";
};

export type GuideDecision =
  | { kind: "already-complete"; text: string }
  | {
      kind: "complete";
      setDone: true;
      rewardPoints: number;
      notification: QuestNotification;
      text: string;
    }
  | { kind: "start-or-progress"; setStarted: true; text: string };

export type VillageNodeDecision =
  | { kind: "needs-guide"; text: string }
  | { kind: "already-complete"; text: string }
  | { kind: "already-restored"; text: string }
  | {
      kind: "restore-node";
      nodesRestored: number;
      markCollected: true;
      rewardPoints: number;
      notification: QuestNotification;
      text: string;
    };

export function decideGuideAction(snapshot: QuestSnapshot): GuideDecision {
  if (snapshot.done) {
    return {
      kind: "already-complete",
      text: "Village restoration complete. Return to the web page to claim your guest badge or add an optional wallet proof.",
    };
  }

  if (snapshot.nodesRestored >= VILLAGE_NODE_TOTAL) {
    return {
      kind: "complete",
      setDone: true,
      rewardPoints: VILLAGE_COMPLETION_REWARD,
      notification: {
        message: "Village restored! +100 off-chain points.",
        sound: "quest-complete",
        type: "info",
      },
      text: "Cozy Resource-Village Loop complete. You restored all 3 village nodes and earned +100 off-chain points.",
    };
  }

  return {
    kind: "start-or-progress",
    setStarted: true,
    text: `Village restoration: activate 3 village nodes. Press Space near a glowing node. Off-chain progress: ${snapshot.nodesRestored}/${VILLAGE_NODE_TOTAL}`,
  };
}

export function decideVillageNodeAction(
  snapshot: QuestSnapshot,
): VillageNodeDecision {
  if (!snapshot.started) {
    return {
      kind: "needs-guide",
      text: "Talk to the AI Guide first. The village loop starts there.",
    };
  }

  if (snapshot.done) {
    return {
      kind: "already-complete",
      text: "This village node is already restored.",
    };
  }

  if (snapshot.nodeCollected) {
    return {
      kind: "already-restored",
      text: "This village node is already glowing. Find another node.",
    };
  }

  const nodesRestored = Math.min(
    snapshot.nodesRestored + 1,
    VILLAGE_NODE_TOTAL,
  );

  return {
    kind: "restore-node",
    nodesRestored,
    markCollected: true,
    rewardPoints: VILLAGE_NODE_REWARD,
    notification: {
      message: `Village node restored ${nodesRestored}/${VILLAGE_NODE_TOTAL}.`,
      sound: "collect",
      type: "info",
    },
    text: `Village node restored. Off-chain progress: ${nodesRestored}/${VILLAGE_NODE_TOTAL}. +10 points.`,
  };
}
