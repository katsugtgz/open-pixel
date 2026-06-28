// W2.2 - CropPlot event factory (farm_plots layer).
//
// Each call returns a fresh EventDefinition bound to one Tiled plot object. The
// factory closes over the parsed Tiled properties (id, rewardItem, initialState)
// because RPG-JS v5 does not auto-flow custom properties into EventDefinitions
// (see docs/agents/resource-village-deterministic-packet.md §3.1 workaround).
//
// The plot lifecycle is owned by state.ts::advancePlotState. This factory only
// derives the action verb from the current state, applies the transition, and
// awards the reward item + points when the cycle completes (ready -> empty).
//
// Hackathon loop (locked W0.1 §5): every step is free, growth is instant.
//   Space on empty    -> planted   (auto-seeded for the hackathon slice)
//   Space on planted  -> watered
//   Space on watered  -> ready     (crop finishes growing)
//   Space on ready    -> empty     (harvest: +1 reward item, +5 points)
import { type EventDefinition, RpgPlayer } from "@rpgjs/server";
import {
  type PlotAction,
  type PlotState,
  advancePlotState,
  pointsFromCompletion,
} from "../state";

/** Player variable holding the total off-chain village points. */
export const VILLAGE_POINTS_KEY = "village_points";

/**
 * Derive the action verb the player is performing from the current plot state.
 * `watered`, `grown`, and `ready` all map to a harvest intent so the player
 * just presses Space repeatedly to walk the cycle forward.
 */
function actionForPlotState(state: PlotState): PlotAction {
  if (state === "empty") return "plant";
  if (state === "planted") return "water";
  return "harvest";
}

function addPoints(player: RpgPlayer, pts: number): void {
  const current = player.getVariable<number>(VILLAGE_POINTS_KEY) ?? 0;
  player.setVariable(VILLAGE_POINTS_KEY, current + pts);
}

export interface CropPlotProps {
  id: string;
  rewardItem?: string;
  initialState?: PlotState;
}

/**
 * Build an invisible hitbox event for a farm plot. The visual crop tiles live
 * on the map's tile layers (placed in W2.1); this event only carries the
 * interaction logic, so it intentionally sets no graphic.
 */
export function CropPlotFactory(props: CropPlotProps): EventDefinition {
  const plotId = props.id;
  const rewardItem = props.rewardItem ?? "popberry";
  const initialState: PlotState = props.initialState ?? "empty";
  const stateKey = `plot_state_${plotId}`;
  return {
    name: plotId,
    async onAction(player: RpgPlayer) {
      const current = player.getVariable<PlotState>(stateKey) ?? initialState;
      const action = actionForPlotState(current);
      const next = advancePlotState(current, action);
      player.setVariable(stateKey, next);

      if (next === "empty" && current === "ready") {
        // Harvest complete: award one reward item and off-chain points.
        player.addItem(rewardItem, 1);
        const pts = pointsFromCompletion("harvest");
        addPoints(player, pts);
        await player.showNotification(`Harvested Popberry · +1 · +${pts} pts`, {
          sound: "collect",
          type: "info",
        });
        return;
      }

      if (next !== current) {
        await player.showText(`Plot ${plotId}: ${current} → ${next}`);
      }
    },
  };
}
