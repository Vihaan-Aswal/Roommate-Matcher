import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "node ./scripts/start-backend-e2e.mjs",
      url: "http://127.0.0.1:8000/health",
      timeout: 180_000,
      reuseExistingServer: true,
    },
    {
      command: "node ./scripts/start-frontend-e2e.mjs",
      url: "http://localhost:5173",
      timeout: 180_000,
      reuseExistingServer: true,
    },
  ],
});
