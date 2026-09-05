import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 30000,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
    },
  },
});
