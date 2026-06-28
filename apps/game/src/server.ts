import {
  createServer,
  provideServerModules,
  LocalStorageSaveStorageStrategy,
} from "@rpgjs/server";
import { provideMain } from "./modules/main";
import { provideSaveStorage } from "@rpgjs/server";
import { provideTiledMap } from "@rpgjs/tiledmap/server";
import {
  Popberry,
  PopberrySeeds,
  WhittlewoodLog,
  OchruxMatrix,
} from "./modules/village/items";

export default createServer({
  providers: [
    provideMain(),
    provideSaveStorage(new LocalStorageSaveStorageStrategy({ key: "save" })),
    // Database keys must match the @Item ids and the ItemId union in
    // village/inventory.ts. Save key stays "save" until W2.2 bumps it to
    // "save-village" (W0.1 Appendix B locked decision).
    provideServerModules([
      {
        database: {
          popberry: Popberry,
          popberry_seeds: PopberrySeeds,
          whittlewood_log: WhittlewoodLog,
          ochrux_matrix: OchruxMatrix,
        },
      },
    ]),
    provideTiledMap(),
  ],
});
