import { defineModule } from "@rpgjs/common";
import { RpgServer } from "@rpgjs/server";
import { QuestGiver, PixelShard } from "./event";
import {
  type MapRole,
  MAP_ROLES,
  SIMPLEMAP_ID,
  VILLAGE_NODE_ROLES,
} from "./layoutRoles";
import { player } from "./player";

function eventPosition(role: MapRole) {
  return { id: role.id, x: role.x, y: role.y };
}

export default defineModule<RpgServer>({
  player,
  maps: [
    {
      id: SIMPLEMAP_ID,
      events: [
        { ...eventPosition(MAP_ROLES.aiGuide), event: QuestGiver() },
        ...VILLAGE_NODE_ROLES.map((role) => ({
          ...eventPosition(role),
          event: PixelShard(),
        })),
      ],
    },
  ],
});
