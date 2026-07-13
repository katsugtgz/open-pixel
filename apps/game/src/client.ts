import "@rpgjs/ui-css/index.css";
import "@rpgjs/ui-css/theme-default.css";
import { startGame, provideMmorpg } from "@rpgjs/client";
import configClient from "./config/config.client";
import { mergeConfig } from "@signe/di";

startGame(
  mergeConfig(configClient, {
    providers: [provideMmorpg({})],
  }),
);
