import { defineModule } from "@rpgjs/common";
import { RpgServer } from "@rpgjs/server";
import { player } from "./player";
import { QuestGiver, PixelShard } from "./event";

export default defineModule<RpgServer>({
  player,
  maps: [
    {
      id: "map",
      events: [
        { id: "ai-guide", x: 571, y: 417, event: QuestGiver() },
        { id: "shard-1", x: 500, y: 351, event: PixelShard() },
        { id: "shard-2", x: 650, y: 350, event: PixelShard() },
        { id: "shard-3", x: 560, y: 520, event: PixelShard() },
      ],
    },
  ],
});
