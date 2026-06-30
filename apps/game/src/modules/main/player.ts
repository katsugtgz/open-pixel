import { RpgPlayer, type RpgPlayerHooks } from "@rpgjs/server";
import { MAP_ROLES } from "./layoutRoles";

export const player: RpgPlayerHooks = {
  onConnected(player: RpgPlayer) {
    player.changeMap(MAP_ROLES.playerSpawn.map, {
      x: MAP_ROLES.playerSpawn.x,
      y: MAP_ROLES.playerSpawn.y,
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
