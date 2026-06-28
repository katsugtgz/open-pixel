import { RpgPlayer, type RpgPlayerHooks, Components } from "@rpgjs/server";

export const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    player.changeMap("village", {
      x: 640,
      y: 640,
    });
    player.name = "YourName";
    player.setGraphic("hero");
  },
  onInput(player: RpgPlayer, { action }) {
    if (action == "escape") {
      player.callMainMenu();
    }
  },
};
