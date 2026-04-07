import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'
import { exportPublicKey, generateKeyPair } from '../packages/core-ts/src/crypto/ecdh.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Mnemo Form Error Handling', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('should display error message and re-enable submit button on submission failure', async ({ page }) => {
    // 1. Setup session data
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = crypto.randomUUID()

    // 2. Create session on relay with a schema that has some fields
    const schema = {
      fields: [
        { key: 'API_KEY', label: 'API Key', type: 'password', required: true }
      ]
    }

    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'mnemo-test', schema }),
    })
    expect(createRes.status).toBe(201)

    // 3. Open Mnemo setup page
    const setupUrl = `${relay.url}/mnemo/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // 4. Mock the result submission to fail with 500
    await page.route(`**/api/sessions/${sessionId}/result`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Server Error' }),
      })
    })

    // 5. Fill and submit
    await page.fill('#API_KEY', 'test-api-key')
    const submitBtn = page.locator('#submit-btn')
    await submitBtn.click()

    // 6. Verify error handling
    // Check for error status
    const statusContainer = page.locator('.status-error')
    await expect(statusContainer).toBeVisible()
    await expect(statusContainer).toContainText('Submit failed (500): {"error":"Server Error"}')

    // Check that submit button is re-enabled and has original text
    await expect(submitBtn).toBeEnabled()
    await expect(submitBtn).toHaveText('Encrypt & Send')
  })
})
