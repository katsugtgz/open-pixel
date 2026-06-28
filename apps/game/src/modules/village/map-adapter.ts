// W1.3 stub — implementation lands in W2.2.
// Per W0.1 §3.1: Tiled custom properties DO NOT auto-flow in RPG-JS v5.
// Use map.onLoad → map.getLayerByName(layer).objects → parse .properties → map.createDynamicEvent.
import type { RpgMap } from "@rpgjs/server";

export interface TiledObjectProps {
  name: string;
  class?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  properties?: Record<string, unknown>;
}

export function registerMapObjects(map: RpgMap): void {
  throw new Error("W1.3 stub: registerMapObjects");
}

export function parseTiledProperties(
  raw: Array<{ name: string; value: unknown; type?: string }>,
): Record<string, unknown> {
  throw new Error("W1.3 stub: parseTiledProperties");
}
