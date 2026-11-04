import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Same port as `pnpm dev` (scripts/port.mjs). Run as a process: Playwright loads this config as CJS.
const PORT = execFileSync(process.execPath, [join(__dirname, 'scripts/port.mjs')], {
  encoding: 'utf8',
}).trim();
const LOCAL_URL = `http://localhost:${PORT}`;
// CI runs a production build: `next dev` compiles each route on first visit (up to 30 s a page).
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: CI ? 1 : 0,
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
    command: CI ? 'pnpm build && pnpm start' : 'pnpm dev',
    url: LOCAL_URL,
    reuseExistingServer: !CI,
    timeout: CI ? 300_000 : 60_000,
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
