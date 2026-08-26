import { defineConfig, devices } from '@playwright/test'

const useBuiltClient = process.env.CREATPPT_E2E_BUILT === '1'
const e2ePort = Number(process.env.CREATPPT_E2E_PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${e2ePort}`,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: useBuiltClient ? 'npm run dev:e2e:built' : 'npm run dev:e2e',
    url: `http://127.0.0.1:${e2ePort}/api/health`,
    reuseExistingServer: !useBuiltClient,
    timeout: 120_000,
  },
})
