// W2.2 - Map adapter: the RPG-JS v5 workaround for Tiled custom properties.
//
// RPG-JS v5 does not auto-flow Tiled custom properties into EventDefinitions.
// At map load the runtime reads only `obj.name`, `obj.x`, `obj.y`, `obj.point`,
// and `obj.class === 'start'` (source: @rpgjs/tiledmap server module's
// `applyTiledPointEvents` step). To bind gameplay objects (plots, trees, mines)
// to interactive events, the village objects must be converted into event
// definitions by hand. See docs/agents/resource-village-deterministic-packet.md
// §3.1.
//
// This module exposes two surfaces:
//
// 1. `VILLAGE_EVENTS` - the static `events` array for the village MapOptions,
//    derived from apps/game/src/tiled/village.tmx (W2.1 frozen). village/index.ts
//    passes it to `maps: [{ id, events }]`, and RPG-JS v5 creates each entry via
//    `map.createDynamicEvent` during updateMap (the same mechanism the legacy
//    simplemap module used). The coordinates/properties below are produced by
//    parsing village.tmx with @canvasengine/tiled's TiledParser (see
//    registerMapObjects for the runtime equivalent); they are inlined here
//    because RPG-JS v5 shares the server module graph with the client, so a
//    module-load `readFileSync` would break the browser bundle (Vite
//    externalizes node:fs).
//
// 2. `registerMapObjects(map)` - the runtime `map.onLoad`-style adapter from the
//    W0.1 contract. It walks `map.tiled` (populated by the @rpgjs/tiledmap
//    server module) and calls `map.createDynamicEvent` for each bindable object.
//    Idempotent (skips ids that already exist) so it composes safely with the
//    static events. In RPG-JS v5.0.0-beta.1 dev the module-level `map.onLoad`
//    hook does not fire reliably for this module, so VILLAGE_EVENTS is the
//    primary binding; registerMapObjects is kept for the contract and for
//    production paths where the hook fires.
//
// parseTiledProperties tolerates both the raw Tiled `[{name, value}]` array and
// the @canvasengine/tiled parsed `{key: value}` map so it stays unit-testable.
import type {
  EventDefinition,
  EventPosOption,
  MapOptions,
  RpgMap,
  RpgPlayer,
} from "@rpgjs/server";
import type { TiledLayer, TiledObject } from "@canvasengine/tiled";
import type { PlotState } from "./state";
import { CropPlotFactory } from "./events/crop-plot";
import { TreeFactory } from "./events/tree";
import { MineFactory } from "./events/mine";
import { OrderBoardFactory } from "./events/order-board";

/** Layers that carry bindable gameplay objects. `decor`/`collisions`/`spawn` are skipped. */
const GAMEPLAY_LAYERS = [
  "farm_plots",
  "resource_nodes",
  "workstations",
] as const;

export interface TiledObjectProps {
  name: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
}

/**
 * Parse Tiled custom properties into a plain key->value map.
 *
 * Tolerates both shapes:
 * - the raw Tiled export `[{ name, value, type? }]`
 * - the @canvasengine/tiled runtime already-parsed `{ key: value }` map
 */
export function parseTiledProperties(
  raw:
    | Array<{ name: string; value: unknown; type?: string }>
    | Record<string, unknown>
    | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const entry of raw) {
      if (entry && typeof entry.name === "string") {
        out[entry.name] = entry.value;
      }
    }
    return out;
  }
  if (typeof raw === "object") {
    return { ...raw };
  }
  return {};
}

/** A parsed Tiled map value that supports layer lookup by name. */
interface LayerReadable {
  getLayerByName(name: string): TiledLayer | undefined;
}

/**
 * Walk the gameplay object layers of a parsed Tiled map and invoke `cb` for each
 * bindable object together with its parsed custom properties.
 */
function forEachBindableObject(
  tiled: LayerReadable,
  cb: (obj: TiledObject, properties: Record<string, unknown>) => void,
): void {
  for (const layerName of GAMEPLAY_LAYERS) {
    const layer = tiled.getLayerByName(layerName) as TiledLayer | undefined;
    if (!layer || !Array.isArray(layer.objects)) continue;
    for (const obj of layer.objects) {
      const properties = parseTiledProperties(
        obj.properties as Record<string, unknown> | undefined,
      );
      cb(obj as TiledObject, properties);
    }
  }
}

/**
 * Map a parsed Tiled object's `kind` to a concrete EventDefinition. Returns null
 * for kinds that have no factory yet or that are non-gameplay (collision,
 * spawn, decor). W3.1 adds the `board` kind -> OrderBoardFactory.
 */
function buildEvent(
  properties: Record<string, unknown>,
  fallbackName: string,
): EventDefinition | null {
  const kind = properties.kind as string | undefined;
  const id = (properties.id as string | undefined) ?? fallbackName;
  const rewardItem = properties.rewardItem as string | undefined;
  const initialState = properties.initialState as PlotState | undefined;

  if (kind === "plot") {
    return CropPlotFactory({ id, rewardItem, initialState });
  }
  if (kind === "tree") {
    return TreeFactory({ id, rewardItem });
  }
  if (kind === "mine") {
    return MineFactory({ id, rewardItem });
  }
  if (kind === "board") {
    const orderId = (properties.orderId as string | undefined) ?? "order_01";
    return OrderBoardFactory({ id, orderId });
  }
  return null;
}

/**
 * An EventPosOption extended with the Tiled object's dimensions. RPG-JS v5's
 * EventPosOption carries only `{id, x, y, event}` and reads the hitbox from
 * the event instance post-creation (defaulting to one tile). We carry the
 * Tiled `width`/`height` through as `hitbox.{w,h}` so registerMapObjects can
 * size the freshly created event via RpgPlayer.setHitbox.
 */
export interface VillageEventPlacement extends EventPosOption {
  hitbox?: { w: number; h: number };
}

/**
 * Build the EventPosOption list for one parsed Tiled object layer, used by both
 * VILLAGE_EVENTS (via buildVillageEvents) and registerMapObjects. Preserves
 * the object's width/height as `hitbox.{w,h}` so multi-tile objects (trees
 * 64x96, boards 64x32) get a correctly sized interaction hitbox instead of
 * the default 1-tile hitbox.
 */
export function eventFromObject(
  obj: TiledObject,
  properties: Record<string, unknown>,
): VillageEventPlacement | null {
  const event = buildEvent(properties, obj.name);
  if (!event) return null;
  const placement: VillageEventPlacement = {
    id: obj.name,
    x: obj.x,
    y: obj.y,
    event,
  };
  if (
    typeof obj.width === "number" &&
    typeof obj.height === "number" &&
    obj.width > 0 &&
    obj.height > 0
  ) {
    placement.hitbox = { w: obj.width, h: obj.height };
  }
  return placement;
}

/**
 * Source-of-truth board placements on the workstations layer. Each entry maps
 * 1:1 to an `<object name=...>` in village.tmx and to one VILLAGE_ORDER id in
 * orders.ts. VILLAGE_EVENTS's board section is derived from this array so the
 * two never drift; `boardPlacements()` is the testable projection used to
 * verify every order has a board.
 */
export interface BoardPlacement {
  id: string;
  orderId: string;
  x: number;
  y: number;
}

const BOARD_PLACEMENTS: BoardPlacement[] = [
  { id: "board_orders", orderId: "order_01", x: 448, y: 576 },
  { id: "board_orders_02", orderId: "order_02", x: 512, y: 576 },
];

/**
 * Project the board placements as `{id, orderId}` pairs. Exported so tests can
 * verify every VILLAGE_ORDER has at least one board binding without reaching
 * into the OrderBoardFactory closure.
 */
export function boardPlacements(): Pick<BoardPlacement, "id" | "orderId">[] {
  return BOARD_PLACEMENTS.map(({ id, orderId }) => ({ id, orderId }));
}

/**
 * Static events array for the village MapOptions. Coordinates and properties
 * mirror apps/game/src/tiled/village.tmx (W2.1 frozen): three farm plots on
 * the farm_plots layer, three trees and two mines on the resource_nodes layer,
 * and one order board per VILLAGE_ORDER on the workstations layer (W3.1).
 *
 * RPG-JS v5 creates each entry through `map.createDynamicEvent` during updateMap.
 */
export const VILLAGE_EVENTS: EventPosOption[] = [
  {
    id: "plot_01",
    x: 544,
    y: 768,
    event: CropPlotFactory({
      id: "plot_01",
      rewardItem: "popberry",
      initialState: "empty",
    }),
  },
  {
    id: "plot_02",
    x: 640,
    y: 768,
    event: CropPlotFactory({
      id: "plot_02",
      rewardItem: "popberry",
      initialState: "empty",
    }),
  },
  {
    id: "plot_03",
    x: 736,
    y: 768,
    event: CropPlotFactory({
      id: "plot_03",
      rewardItem: "popberry",
      initialState: "empty",
    }),
  },
  {
    id: "tree_01",
    x: 800,
    y: 416,
    event: TreeFactory({ id: "tree_01", rewardItem: "whittlewood_log" }),
  },
  {
    id: "tree_02",
    x: 896,
    y: 416,
    event: TreeFactory({ id: "tree_02", rewardItem: "whittlewood_log" }),
  },
  {
    id: "tree_03",
    x: 992,
    y: 416,
    event: TreeFactory({ id: "tree_03", rewardItem: "whittlewood_log" }),
  },
  {
    id: "mine_01",
    x: 896,
    y: 832,
    event: MineFactory({ id: "mine_01", rewardItem: "ochrux_matrix" }),
  },
  {
    id: "mine_02",
    x: 992,
    y: 896,
    event: MineFactory({ id: "mine_02", rewardItem: "ochrux_matrix" }),
  },
  ...BOARD_PLACEMENTS.map(({ id, orderId, x, y }) => ({
    id,
    x,
    y,
    event: OrderBoardFactory({ id, orderId }),
  })),
];

/**
 * Runtime adapter: register dynamic events for every bindable Tiled object on
 * the given map by walking `map.tiled`. Idempotent - skips ids that already
 * exist (e.g. ones created from VILLAGE_EVENTS) so it composes safely if the
 * runtime map hook fires. No-ops when the map has no `tiled` data or is not the
 * village. Kept for the W0.1 §3.1 contract and production paths where map hooks
 * fire; in v5.0.0-beta.1 dev the module-level map.onLoad hook is unreliable, so
 * VILLAGE_EVENTS is the primary binding.
 */
export async function registerMapObjects(map: RpgMap): Promise<void> {
  const tiled = (map as RpgMap & { tiled?: LayerReadable }).tiled;
  if (!tiled) return;
  if (map.id !== "village") return;
  const creations: Promise<unknown>[] = [];
  forEachBindableObject(tiled, (obj, properties) => {
    if (map.getEvent(obj.name)) return;
    const placement = eventFromObject(obj, properties);
    if (!placement) return;
    const { hitbox, ...eventPos } = placement;
    creations.push(
      map.createDynamicEvent(eventPos).then((id) => {
        if (hitbox && typeof id === "string") {
          // EventPosOption has no dim fields; apply via RpgPlayer.setHitbox
          // (RpgEvent extends RpgPlayer) so a 64x96 tree / 64x32 board gets a
          // correctly sized interaction hitbox instead of the default 1 tile.
          const ev = map.getEvent<RpgPlayer>(id);
          ev?.setHitbox(hitbox.w, hitbox.h);
        }
        return id;
      }),
    );
  });
  const results = await Promise.allSettled(creations);
  const failed = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  if (failed.length > 0) {
    const reasons = failed
      .map(
        (f, i) =>
          `[${i}] ${
            f.reason instanceof Error ? f.reason.message : String(f.reason)
          }`,
      )
      .join("; ");
    throw new Error(
      `registerMapObjects: ${failed.length}/${results.length} createDynamicEvent calls rejected: ${reasons}`,
    );
  }
}

/**
 * Static hitbox placement for `MapOptions.hitboxes`. Runtime consumer is
 * @rpgjs/common's RpgMap.loadPhysic, which calls addStaticHitbox(id,x,y,w,h)
 * for each entry.
 */
export interface VillageHitbox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Static hitboxes projected 1:1 from the `collisions` objectgroup in
 * apps/game/src/tiled/village.tmx. RPG-JS v5's @rpgjs/tiledmap reads only
 * per-tile `collision` properties and ignores Tiled objectgroup rectangles,
 * so we surface them here. The `collision_house` entry is the bug fix: the
 * house is a plain Structures-layer tile with no per-tile collision, so
 * without this entry the player can walk onto it. Trees/mines already
 * collide via event setHitbox and are duplicated here for documentation
 * parity with the TMX author intent.
 */
export const VILLAGE_HITBOXES: readonly VillageHitbox[] = [
  { id: "collision_water", x: 0, y: 0, width: 64, height: 1280 },
  { id: "collision_house", x: 256, y: 448, width: 160, height: 160 },
  { id: "collision_tree_01", x: 800, y: 416, width: 64, height: 96 },
  { id: "collision_tree_02", x: 896, y: 416, width: 64, height: 96 },
  { id: "collision_tree_03", x: 992, y: 416, width: 64, height: 96 },
  { id: "collision_mine_01", x: 896, y: 832, width: 32, height: 32 },
  { id: "collision_mine_02", x: 992, y: 896, width: 32, height: 32 },
];

/**
 * Augment upstream MapOptions: runtime zod schema declares
 * `hitboxes: array(any()).optional()` and RpgMap.loadPhysic reads it via
 * `mapData?.hitboxes` (common/src/rooms/Map.ts:380), but the shipped TS
 * interface omits the field. This augmentation lets the village module
 * pass VILLAGE_HITBOXES without `as any` / `@ts-ignore`.
 */
declare module "@rpgjs/server" {
  interface MapOptions {
    hitboxes?: readonly VillageHitbox[];
  }
}
