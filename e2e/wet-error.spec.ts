import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { exportPublicKey, generateKeyPair } from '../packages/core-ts/src/crypto/ecdh.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Wet Form Error Handling', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('skip button handles error correctly', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = crypto.randomUUID()

    // 1. Create session
    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'wet-mcp', schema: {} })
    })

    // 2. Intercept skip request and return 500
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    // 3. Navigate to wet setup page
    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // 4. Click Skip button
    const skipBtn = page.locator('#skip-btn')
    await expect(skipBtn).toBeVisible()
    await skipBtn.click()

    // 5. Verify error status and button re-enabled
    await expect(page.locator('.status-error')).toBeVisible()
    await expect(page.locator('.status-error')).toContainText('Internal Server Error')
    await expect(skipBtn).toBeEnabled()
    await expect(skipBtn).toHaveText('Skip (use local mode)')
  })
})
