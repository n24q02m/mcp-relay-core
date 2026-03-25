import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:0', // set dynamically in tests
  },
  webServer: undefined, // we start server manually in tests
})
