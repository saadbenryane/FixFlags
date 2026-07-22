import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.E2E_BASE_URL
const baseURL = externalBaseUrl ?? 'http://127.0.0.1:3107'

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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // Keep browser verification isolated from active local development
        // servers that may also be compiling the same workspace.
        command:
          'FIXFLAGS_ALLOW_DEGRADED_LOCAL=true NEXT_PUBLIC_APP_URL=http://127.0.0.1:3107 BETTER_AUTH_URL=http://127.0.0.1:3107 NEXT_DIST_DIR=.next-e2e npm run build -- --no-lint && FIXFLAGS_ALLOW_DEGRADED_LOCAL=true NEXT_PUBLIC_APP_URL=http://127.0.0.1:3107 BETTER_AUTH_URL=http://127.0.0.1:3107 NEXT_DIST_DIR=.next-e2e PORT=3107 npm run start',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 240_000,
      },
})
