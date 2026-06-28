import {
  createServer,
  provideServerModules,
  LocalStorageSaveStorageStrategy,
} from "@rpgjs/server";
import { villageServer } from "./modules/village";
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
    // The village module and the @Item database ride in one provideServerModules
    // call so their hooks/database land in the same server Hooks instance.
    // Passing the village module via a separate createModule provider does not
    // register its player/map hooks in RPG-JS v5 - see village/index.ts.
    // Database keys must match the @Item ids and the ItemId union in
    // village/inventory.ts. Save key stays "save" until W3.1 bumps it to
    // "save-village" (W0.1 Appendix B locked decision).
    provideServerModules([
      villageServer,
      {
        database: {
          popberry: Popberry,
          popberry_seeds: PopberrySeeds,
          whittlewood_log: WhittlewoodLog,
          ochrux_matrix: OchruxMatrix,
        },
      },
    ]),
    provideSaveStorage(new LocalStorageSaveStorageStrategy({ key: "save" })),
    provideTiledMap(),
  ],
});
