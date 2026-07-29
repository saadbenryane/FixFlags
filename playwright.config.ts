import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.E2E_BASE_URL
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:3107'
const credentialedDatabaseUrl =
  process.env.E2E_CREDENTIALED === 'true' ? process.env.RELEASE_FRESH_DATABASE_URL : undefined

const localRuntimeEnv = {
  FIXFLAGS_ALLOW_DEGRADED_LOCAL: 'true',
  // Exercise production quota and anonymous-teaser gates in local E2E.
  // Development otherwise grants unlimited scans by design.
  DEV_SIMULATE_BILLING: 'true',
  NEXT_PUBLIC_APP_URL: baseURL,
  BETTER_AUTH_URL: baseURL,
  NEXT_DIST_DIR: '.next-e2e',
  PORT: '3107',
  WORKER_HEALTH_PORT: '3108',
  ...(credentialedDatabaseUrl ? { DATABASE_URL: credentialedDatabaseUrl } : {}),
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        // Keep browser verification isolated from active local development
        // servers that may also be compiling the same workspace.
        command:
          'node scripts/next-build.mjs .next-e2e --no-lint && npm run worker:build && node scripts/prepare-standalone-runtime.mjs && concurrently -k -n web,worker "node scripts/runtime-start.mjs web" "node scripts/runtime-start.mjs worker"',
        env: localRuntimeEnv,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
})
