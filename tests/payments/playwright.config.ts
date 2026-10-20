import { defineConfig } from '@playwright/test'
import { resolve } from 'node:path'
const requestedPort = Number(process.env.MILLENNIUM_E2E_PORT)
const appPort = Number.isInteger(requestedPort) && requestedPort > 1024 && requestedPort < 65534 ? requestedPort : 4313
export default defineConfig({ testDir: '.', testMatch: 'access.spec.ts', timeout: 45000,
  workers: 1, retries: 0, use: { baseURL: `http://127.0.0.1:${appPort}`, trace: 'retain-on-failure',
    channel: process.env.MILLENNIUM_TEST_BROWSER_CHANNEL === 'msedge' ? 'msedge' : undefined },
  webServer: { command: 'node tests/payments/e2e-server.mjs', cwd: resolve(__dirname, '../..'), url: `http://127.0.0.1:${appPort}/auth/login`, timeout: 120000, reuseExistingServer: false },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
})
