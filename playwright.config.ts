import { defineConfig, devices } from '@playwright/test'

const selectedProductionOrigin = process.argv.some((value) => value.includes('giving-production-origin-sandbox'))
const selectedMockedUi = process.argv.some((value) => value.includes('giving-mocked-ui-contract'))
if (selectedMockedUi && !process.env.GIVING_E2E_MOCKED_UI_BASE_URL) throw new Error('GIVING_E2E_MOCKED_UI_BASE_URL is required for mocked composed UI-contract coverage')
if (selectedProductionOrigin) {
  for (const name of ['GIVING_E2E_PRODUCTION_BASE_URL','GIVING_E2E_ADMIN_EMAIL','GIVING_E2E_ADMIN_STORAGE_STATE']) {
    if (!process.env[name]) throw new Error(`${name} is required for the manual production-origin sandbox project`)
  }
  if (new URL(process.env.GIVING_E2E_PRODUCTION_BASE_URL!).origin !== 'https://www.ev.church') throw new Error('GIVING_E2E_PRODUCTION_BASE_URL must be https://www.ev.church')
}

export default defineConfig({
  testDir: './e2e/giving',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: { trace: 'retain-on-failure', video: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'giving-mocked-ui-contract',
      testIgnore: /production-origin-sandbox\.spec\.ts/u,
      use: { ...devices['Desktop Chrome'], baseURL: process.env.GIVING_E2E_MOCKED_UI_BASE_URL ?? 'http://127.0.0.1:3000' },
    },
    {
      name: 'giving-production-origin-sandbox',
      testMatch: /production-origin-sandbox\.spec\.ts/u,
      timeout: 120_000,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        baseURL: process.env.GIVING_E2E_PRODUCTION_BASE_URL ?? 'https://www.ev.church',
        storageState: process.env.GIVING_E2E_ADMIN_STORAGE_STATE,
      },
    },
  ],
})
