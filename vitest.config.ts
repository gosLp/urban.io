import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    root: resolve(__dirname),
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@engine": resolve(__dirname, "src"),
    },
  },
});
