import { defineConfig, devices } from '@playwright/test';
import { resolvePort } from './scripts/port.mjs';

const LOCAL_URL = `http://localhost:${resolvePort()}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || LOCAL_URL,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'pnpm dev',
    url: LOCAL_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      LLM_PROVIDER: 'mock',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
