import "@rpgjs/ui-css/index.css";
import "@rpgjs/ui-css/theme-default.css";
import { mergeConfig } from "@signe/di";
import { provideRpg, startGame } from "@rpgjs/client";
import startServer from "./server";
import configClient from "./config/config.client";

startGame(
  mergeConfig(configClient, {
    providers: [provideRpg(startServer)],
  }),
);
