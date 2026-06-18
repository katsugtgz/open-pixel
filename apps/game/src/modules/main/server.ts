import { defineModule } from "@rpgjs/common";
import { RpgServer } from "@rpgjs/server";
import { player } from "./player";
import { QuestGiver, PixelShard } from "./event";

export default defineModule<RpgServer>({
  player,
  maps: [
    {
      id: "simplemap",
      events: [
        { id: "ai-guide", x: 300, y: 400, event: QuestGiver() },
        { id: "shard-1", x: 250, y: 350, event: PixelShard() },
        { id: "shard-2", x: 350, y: 350, event: PixelShard() },
        { id: "shard-3", x: 300, y: 500, event: PixelShard() },
      ],
    },
  ],
});
