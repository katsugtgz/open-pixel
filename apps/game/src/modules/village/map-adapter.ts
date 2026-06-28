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
import type { EventDefinition, EventPosOption, RpgMap } from "@rpgjs/server";
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
 * Build the EventPosOption list for one parsed Tiled object layer, used by both
 * VILLAGE_EVENTS (via buildVillageEvents) and registerMapObjects.
 */
function eventFromObject(
  obj: TiledObject,
  properties: Record<string, unknown>,
): EventPosOption | null {
  const event = buildEvent(properties, obj.name);
  if (!event) return null;
  return { id: obj.name, x: obj.x, y: obj.y, event };
}

/**
 * Static events array for the village MapOptions. Coordinates and properties
 * mirror apps/game/src/tiled/village.tmx (W2.1 frozen): three farm plots on
 * the farm_plots layer, three trees and two mines on the resource_nodes layer,
 * and the order board on the workstations layer (W3.1).
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
  {
    id: "board_orders",
    x: 448,
    y: 576,
    event: OrderBoardFactory({ id: "board_orders", orderId: "order_01" }),
  },
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
    creations.push(map.createDynamicEvent(placement));
  });
  await Promise.allSettled(creations);
}
