import {
  provideClientGlobalConfig,
  provideClientModules,
  Presets,
  withMobile,
} from "@rpgjs/client";
import { provideMain } from "../modules/main";
import { provideTiledMap } from "@rpgjs/tiledmap/client";

export default {
  providers: [
    provideTiledMap({
      basePath: "map",
    }),
    provideClientGlobalConfig(),
    provideMain(),
    provideClientModules([
      withMobile(),
      {
        spritesheets: [
          {
            id: "hero",
            image: "spritesheets/hero.png",
            ...Presets.RMSpritesheet(3, 4),
          },
          {
            id: "female",
            image: "spritesheets/female.png",
            ...Presets.RMSpritesheet(3, 4),
          },
          {
            id: "pixel-shard",
            image: "spritesheets/shard.png",
            ...Presets.RMSpritesheet(3, 4),
          },
        ],
        sounds: [
          { id: "collect", src: "audio/collect.wav" },
          { id: "quest-complete", src: "audio/quest-complete.wav" },
          { id: "ui-click", src: "audio/click.wav" },
        ],
      },
    ]),
  ],
};
