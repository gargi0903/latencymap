import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      reportsDirectory: "./coverage",
      reporter: ["json", "text"],
      include: [
        "lib/**/*.ts",
        "lib/**/*.tsx",
        "workers/**/*.ts",
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
