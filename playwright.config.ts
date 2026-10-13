import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8000 },
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'pnpm exec vite --config vite.acl.config.ts',
    url: 'http://127.0.0.1:5187',
    reuseExistingServer: false,
    timeout: 90_000,
  },
})
