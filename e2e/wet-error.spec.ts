import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { exportPublicKey, generateKeyPair } from '../packages/core-ts/src/crypto/ecdh.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Wet Form Skip Error Handling', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('should handle skip error correctly', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = crypto.randomUUID()

    // 1. Create session on relay
    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        serverName: 'wet-mcp',
        schema: {
          fields: [{ key: 'API_KEY', label: 'API Key', type: 'password' }]
        }
      })
    })
    expect(createRes.status).toBe(201)

    // 2. Open Wet relay page
    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // 3. Mock the skip endpoint to return 500
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    // 4. Find and click the Skip button
    const skipBtn = page.locator('button:has-text("Skip")')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    // 5. Verify the button is re-enabled and shows original text
    await expect(skipBtn).toBeEnabled({ timeout: 5000 })
    await expect(skipBtn).toHaveText('Skip (use local mode)')

    // 6. Verify error status is shown
    await expect(page.locator('.status-error')).toBeVisible()
  })
})
