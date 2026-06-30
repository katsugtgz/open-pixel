import {
  provideClientGlobalConfig,
  provideClientModules,
  Presets,
  withMobile,
} from "@rpgjs/client";
import { provideMain } from "../modules/main";
import { provideTiledMap } from "@rpgjs/tiledmap/client";
import { GAME_SMOKE_CONTRACT } from "./gameSmokeContract.js";

const { assets, sounds, sprites } = GAME_SMOKE_CONTRACT;

export default {
  providers: [
    provideTiledMap({
      basePath: assets.mapBasePath,
    }),
    provideClientGlobalConfig(),
    provideMain(),
    provideClientModules([
      withMobile(),
      {
        spritesheets: [
          {
            id: sprites.player.id,
            image: sprites.player.image,
            ...Presets.RMSpritesheet(3, 4),
          },
          {
            id: sprites.guide.id,
            image: sprites.guide.image,
            ...Presets.RMSpritesheet(3, 4),
          },
          {
            id: sprites.shard.id,
            image: sprites.shard.image,
            ...Presets.RMSpritesheet(3, 4),
          },
        ],
        sounds: [
          { id: sounds.collect.id, src: sounds.collect.src },
          { id: sounds.questComplete.id, src: sounds.questComplete.src },
          { id: sounds.uiClick.id, src: sounds.uiClick.src },
        ],
      },
    ]),
  ],
};
