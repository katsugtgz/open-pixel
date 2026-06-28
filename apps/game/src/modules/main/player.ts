import { RpgPlayer, type RpgPlayerHooks, Components } from "@rpgjs/server";

export const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    // Default RPG-JS speed is 4 (too fast/slippy for cozy farming). Reduce to 2.
    player.speed.set(2);
    player.changeMap("village", {
      x: 640,
      y: 640,
    });
    player.name = "";
    player.setGraphic("hero");
    player.setComponentsTop([
      Components.text(
        "Popberry: {popberry}  Wood: {whittlewood_log}  Stone: {ochrux_matrix}  Pts: {village_points}",
        {
          fill: "#ffffff",
          fontSize: 12,
          stroke: "#000000",
          fontFamily: "monospace",
        },
      ),
    ]);
  },
  onInput(player: RpgPlayer, { action }) {
    if (action == "escape") {
      player.callMainMenu();
    }
  },
  onJoinMap(player: RpgPlayer) {
    // Initialize resource variables for component template rendering
    if (!player.hasVariable("popberry")) player.setVariable("popberry", 0);
    if (!player.hasVariable("whittlewood_log"))
      player.setVariable("whittlewood_log", 0);
    if (!player.hasVariable("ochrux_matrix"))
      player.setVariable("ochrux_matrix", 0);
    if (!player.hasVariable("village_points"))
      player.setVariable("village_points", 0);
  },
};
