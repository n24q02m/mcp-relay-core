import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { exportPublicKey, generateKeyPair } from '../packages/core-ts/src/crypto/ecdh.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Mnemo Error Handling', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('should show error message when form submission fails', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = `test-mnemo-session-${crypto.randomUUID()}`

    // 1. Create Mnemo session on relay with a dummy schema
    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        serverName: 'mnemo-test-server',
        schema: {
          fields: [{ key: 'API_KEY', label: 'API Key', type: 'password', required: true }]
        }
      })
    })
    expect(createRes.status).toBe(201)

    // 2. Navigate to Mnemo setup page
    const setupUrl = `${relay.url}/mnemo/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // 3. Mock the submission failure
    // We use a specific response body to verify it's correctly displayed
    const errorBody = '{"error":"Simulated submission failure"}'
    await page.route(`**/api/sessions/${sessionId}/result`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: errorBody
      })
    })

    // 4. Fill and submit the form
    await page.fill('#API_KEY', 'test-api-key')

    const submitBtn = page.locator('#submit-btn')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 5. Verify error message is shown in the UI
    const statusContainer = page.locator('#status-container')
    const errorStatus = statusContainer.locator('.status-error')
    await expect(errorStatus).toBeVisible({ timeout: 5000 })
    await expect(errorStatus).toContainText(`Submit failed (500): ${errorBody}`)

    // 6. Verify submit button is re-enabled for retry
    await expect(submitBtn).toBeEnabled()
    await expect(submitBtn).toHaveText('Encrypt & Send')
  })
})
