import { defineConfig, devices } from '@playwright/test';

/** Playwright configuration for the insurance claims demo application's E2E tests. */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // One worker: parallel claimant logins trip Keycloak's lockout (D3), and parallel
  // requests hit the BFF token race (D6), which specs/claim-ownership.spec.ts reproduces on purpose.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  // The UI container runs `next dev`, which compiles each route on first visit (10s+ when cold).
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3001',
    // The UI formats dates in the browser's timezone; pin it so expected dates are deterministic.
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    // Failure screenshots are taken by the afterEach hook (support/hooks.ts).
    screenshot: 'off',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
});
