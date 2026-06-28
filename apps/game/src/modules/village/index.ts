// W1.3 stub — wiring lands in W2.2 (events) and W3.1 (orders/bridge).
import { defineModule } from "@rpgjs/common";
import { RpgServer } from "@rpgjs/server";

export function provideVillage() {
  throw new Error("W1.3 stub: provideVillage");
}

// Re-exports for convenient imports from elsewhere:
export * from "./state";
export * from "./inventory";
export * from "./orders";
export * from "./map-adapter";
export * from "./hud-adapter";
export * from "./proof-bridge";
