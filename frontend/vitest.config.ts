import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    maxWorkers: 10,
    minWorkers: 10,
    deps: {
      optimizer: {
        web: {
          enabled: true,
          include: ["@testing-library/react", "@tanstack/react-query", "react-router-dom", "lucide-react"],
        },
      },
    },
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "json-summary", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        "src/lib/**": { lines: 85, functions: 85 },
        "src/hooks/**": { lines: 85, functions: 85 },
        "src/pages/**": { lines: 85, functions: 85 },
      },
    },
  },
});
