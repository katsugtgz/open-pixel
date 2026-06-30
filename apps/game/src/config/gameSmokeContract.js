export const GAME_SMOKE_CONTRACT = {
  canvasSelector: "#rpg canvas",
  // RPG-JS renders showText() output into this DOM overlay (in-canvas, not
  // part of the React shell). It only exists while a dialog is open.
  dialogSelector: ".rpg-ui-dialog-body",
  // Static React-shell HUD tracker; always present at /game/. Its text
  // ("Talk to AI Guide -> restore 3 village nodes.") must NEVER be confused
  // with real onAction dialog output.
  hudSelector: ".quest-hint",
  preview: {
    cwd: "apps/web",
    host: "127.0.0.1",
    port: 4173,
    gamePath: "/game/",
  },
  assets: {
    mapBasePath: "map",
    urlMatchers: [
      /\/(map|assets|spritesheets|audio)\//,
      /\/(default-bundle|revoltfx-spritesheet)\.json(?:\?|$)/,
    ],
  },
  sprites: {
    player: {
      id: "hero",
      image: "spritesheets/hero.png",
    },
    guide: {
      id: "female",
      image: "spritesheets/female.png",
    },
    shard: {
      id: "shard",
      image: "spritesheets/shard.png",
    },
  },
  sounds: {
    collect: {
      id: "collect",
      src: "audio/collect.wav",
    },
    questComplete: {
      id: "quest-complete",
      src: "audio/quest-complete.wav",
    },
    uiClick: {
      id: "ui-click",
      src: "audio/click.wav",
    },
  },
  quest: {
    // Source of truth: apps/game/src/modules/main/layoutRoles.ts
    // (MAP_ROLES.aiGuide). Duplicated here as smoke-side ground truth so
    // the harness can verify the player actually reached the guide's
    // onAction range instead of pressing Space at spawn. Do not change
    // one without the other.
    guidePosition: { x: 384, y: 352 },
    // Max pixels between player centre and guide centre for RPG-JS
    // Control.Action to fire onAction on the guide event. RPG-JS requires
    // the player to be on a directly adjacent tile (~32px, one tile) and
    // FACING the event. We allow ~1.5 tiles to absorb sprite-anchor
    // rounding and network-sync jitter, but reject the "pressed Space at
    // spawn" case (spawn is ~135px from the guide) and the "approached to
    // ~2 tiles away" case (~66px) that previously produced false-positive
    // in-range flags without onAction actually firing.
    interactionRange: 48,
    // Substrings that ONLY appear inside real RPG-JS showText() dialog
    // bodies (from event.ts -> decideGuideAction / decideVillageNodeAction),
    // NEVER in the static .quest-hint HUD. Used to prove the guide's
    // onAction hook actually ran and produced in-engine dialog.
    dialogPhrases: [
      "village restoration",
      "press space near a glowing node",
      "off-chain progress",
      "village node restored",
      "talk to the ai guide first",
      "cozy resource-village loop complete",
    ],
  },
  questProgress: {
    phrases: ["quest complete", "collected"],
    pattern: /\/3|quest complete|collected/i,
  },
  movement: {
    minCanvasWidth: 200,
    minCanvasHeight: 200,
    minUniqueFrames: 3,
    minUniquePlayerPositions: 3,
    freezeFrameLimit: 8,
    renderNonBlackPixelThreshold: 500,
  },
};

export function getGamePreviewUrl(contract = GAME_SMOKE_CONTRACT) {
  return `http://${contract.preview.host}:${contract.preview.port}${contract.preview.gamePath}`;
}

export function isGameAssetUrl(value, contract = GAME_SMOKE_CONTRACT) {
  return contract.assets.urlMatchers.some((matcher) => matcher.test(value));
}

export function matchesQuestProgress(value, contract = GAME_SMOKE_CONTRACT) {
  return contract.questProgress.pattern.test(value);
}
