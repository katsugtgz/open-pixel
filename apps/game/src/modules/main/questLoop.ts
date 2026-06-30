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

export type NotificationDecision = {
  message: string;
  sound: "collect" | "quest-complete";
  type: "info";
};

export type QuestDecision =
  | { kind: "already-complete"; text: string }
  | {
      kind: "complete";
      setDone: true;
      rewardPoints: number;
      notification: NotificationDecision;
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
      notification: NotificationDecision;
      text: string;
    };

export function decideGuideAction(snapshot: QuestSnapshot): QuestDecision {
  if (snapshot.done) {
    return {
      kind: "already-complete",
      text: "Village restoration complete. Return web page claim your guest badge or wallet proof.",
    };
  }

  if (snapshot.nodesRestored >= VILLAGE_NODE_TOTAL) {
    return {
      kind: "complete",
      setDone: true,
      rewardPoints: VILLAGE_COMPLETION_REWARD,
      notification: {
        message: "Village restored · +100 points",
        sound: "quest-complete",
        type: "info",
      },
      text: "Village restoration complete! +100 off-chain progress points. Go back web page claim badge.",
    };
  }

  return {
    kind: "start-or-progress",
    setStarted: true,
    text: `Village restoration: activate 3 village nodes. Press Space near each glowing node. Off-chain progress: ${snapshot.nodesRestored}/3`,
  };
}

export function decideVillageNodeAction(
  snapshot: QuestSnapshot,
): VillageNodeDecision {
  if (!snapshot.started) {
    return {
      kind: "needs-guide",
      text: "A restoration shard village. Talk AI Guide first, then return here.",
    };
  }

  if (snapshot.done) {
    return {
      kind: "already-complete",
      text: "You already restored village route.",
    };
  }

  if (snapshot.nodeCollected) {
    return {
      kind: "already-restored",
      text: "This restoration shard already collected.",
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
      message: `Village node restored · ${nodesRestored}/3`,
      sound: "collect",
      type: "info",
    },
    text: `Village node restored. Off-chain progress: ${nodesRestored}/3. +10 points.`,
  };
}
