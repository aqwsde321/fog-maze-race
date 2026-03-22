import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  retries: 0,
  reporter: "list",
  webServer: [
    {
      command:
        "PORT=3000 COUNTDOWN_STEP_MS=50 RESULTS_DURATION_MS=200 RECOVERY_GRACE_MS=350 FORCED_MAP_ID=training-lap pnpm --filter @fog-maze-race/server dev",
      url: "http://127.0.0.1:3000/health",
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: "pnpm --filter @fog-maze-race/web dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30_000
    }
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure"
  }
});
