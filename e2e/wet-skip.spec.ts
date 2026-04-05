import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Wet Skip Error Handling', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('should handle skip failure and reset UI', async ({ page }) => {
    const sessionId = 'test-session-wet-skip-fail'

    // Create session
    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'wet-mcp', schema: { fields: [] } })
    })
    expect(createRes.status).toBe(201)

    // Mock skip endpoint to fail
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    // Navigate to wet page
    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=dummy&p=dummy`
    await page.goto(setupUrl)

    // Find skip button
    const skipBtn = page.locator('button', { hasText: 'Skip (use local mode)' })
    await expect(skipBtn).toBeVisible()

    // Click skip button
    await skipBtn.click()

    // Check for error message
    const statusContainer = page.locator('#status-container')
    await expect(statusContainer).toContainText('Skip failed (500)')

    // Verify button is re-enabled and text is reset
    await expect(skipBtn).toBeEnabled()
    await expect(skipBtn).toHaveText('Skip (use local mode)')

    // Verify form is still visible
    const setupForm = page.locator('#setup-form')
    await expect(setupForm).toBeVisible()
  })
})
