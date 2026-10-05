import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', workers: 2, fullyParallel: true,
  reporter: 'list', timeout: 30000, outputDir: '../../test-results/security-search',
  use: { trace: 'retain-on-failure', channel: process.env.MILLENNIUM_TEST_BROWSER_CHANNEL || undefined },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
  ],
});
