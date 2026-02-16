import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "web",
  resolve: {
    alias: {
      "@engine": resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: resolve(__dirname, "dist-web"),
    emptyOutDir: true,
  },
});
