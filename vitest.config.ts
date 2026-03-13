import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
      thresholds: { statements: 60 },
    },
  },
  resolve: {
    alias: {
      "@cap": path.resolve(__dirname, "src/cap"),
      "@utils": path.resolve(__dirname, "src/utils"),
    },
  },
});
