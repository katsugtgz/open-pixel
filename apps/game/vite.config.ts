import { defineConfig } from "vite";
import { rpgjs, tiledMapFolderPlugin } from "@rpgjs/vite";
import startServer from "./src/server";

export default defineConfig({
  base: "./",
  optimizeDeps: {
    include: ["parse-svg-path", "@xmldom/xmldom"],
  },
  plugins: [
    tiledMapFolderPlugin({
      sourceFolder: "./src/tiled", // Folder containing your TMX files
      publicPath: "/map", // Public URL path for maps
      buildOutputPath: "map", // Must match RPG-JS runtime map fetches.
    }),
    ...rpgjs({
      server: startServer,
    }),
  ],
});
