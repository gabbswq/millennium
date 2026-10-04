import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'

export default defineConfig({ testDir: '.', testMatch: 'captcha.spec.ts', timeout: 45000,
  outputDir: resolve(__dirname, '../../test-results/auth-captcha'),
  workers: 1, retries: 0, use: { baseURL: 'http://127.0.0.1:4315', trace: 'retain-on-failure',
    channel: process.env.MILLENNIUM_TEST_BROWSER_CHANNEL === 'msedge' ? 'msedge' : undefined },
  webServer: { command: 'node tests/payments/e2e-server.mjs --captcha', cwd: resolve(__dirname, '../..'),
    url: 'http://127.0.0.1:4315/auth/login', timeout: 120000, reuseExistingServer: false },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
})
