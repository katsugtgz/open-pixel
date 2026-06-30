import { RpgPlayer, type RpgPlayerHooks } from "@rpgjs/server";

export const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    // Default RPG-JS speed is 4 (too fast/slippy for cozy farming). Reduce to 2.
    // RPG-JS v5.0.0-beta.2+ replaced `player.speed.set(v)` (signal) with the
    // plain setter `player.speed = v`. The signal is still `_speed` internally.
    player.speed = 2;
    player.changeMap("village", {
      x: 640,
      y: 640,
    });
    player.name = "";
    player.setGraphic("hero");
  },
  onInput(player: RpgPlayer, { action }) {
    if (action == "escape") {
      player.callMainMenu();
    }
  },
  onJoinMap(player: RpgPlayer) {
    // Initialize resource variables. Read via player.getVariable('popberry')
    // and surfaced to the DOM HUD through the village:complete socket bridge
    // installed in apps/game/index.html (no in-canvas HUD overlay to avoid
    // the Components.text template + signe signal stringification bug
    // present in @rpgjs/client 5.0.0-beta.1's CanvasEngine `<Text>` render).
    if (!player.hasVariable("popberry")) player.setVariable("popberry", 0);
    if (!player.hasVariable("whittlewood_log"))
      player.setVariable("whittlewood_log", 0);
    if (!player.hasVariable("ochrux_matrix"))
      player.setVariable("ochrux_matrix", 0);
    if (!player.hasVariable("village_points"))
      player.setVariable("village_points", 0);
  },
};
