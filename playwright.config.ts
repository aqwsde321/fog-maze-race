import { defineConfig } from "@playwright/test";

const E2E_SERVER_PORT = 3300;
const E2E_WEB_PORT = 4273;
const E2E_RECOVERY_GRACE_MS = 2_000;

export function buildPlaywrightConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    testDir: "./tests/e2e",
    fullyParallel: true,
    workers: env.CI ? 2 : 1,
    retries: env.CI ? 1 : 0,
    reporter: "list",
    webServer: [
      {
        command:
          `PORT=${E2E_SERVER_PORT} COUNTDOWN_STEP_MS=50 RESULTS_DURATION_MS=1200 ` +
          `RECOVERY_GRACE_MS=${E2E_RECOVERY_GRACE_MS} FORCED_MAP_ID=training-lap ` +
          `pnpm --filter @fog-maze-race/server dev`,
        url: `http://127.0.0.1:${E2E_SERVER_PORT}/health`,
        reuseExistingServer: false,
        timeout: 30_000
      },
      {
        command:
          `VITE_PORT=${E2E_WEB_PORT} VITE_PROXY_TARGET=http://127.0.0.1:${E2E_SERVER_PORT} ` +
          `pnpm --filter @fog-maze-race/web exec vite --host 127.0.0.1 --port ${E2E_WEB_PORT}`,
        url: `http://127.0.0.1:${E2E_WEB_PORT}`,
        reuseExistingServer: false,
        timeout: 30_000
      }
    ],
    use: {
      baseURL: `http://127.0.0.1:${E2E_WEB_PORT}`,
      trace: "retain-on-failure"
    }
  } satisfies Parameters<typeof defineConfig>[0];
}

export default defineConfig(buildPlaywrightConfig());
