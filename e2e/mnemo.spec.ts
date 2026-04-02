import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'
import {
  generateKeyPair,
  exportPublicKey,
} from '../packages/core-ts/src/crypto/ecdh.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')

test.describe('Mnemo Setup E2E', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('successful mnemo setup flow', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')

    const schema = {
      capabilityInfo: [
        { label: 'Test Cap', priority: 'High', description: 'Test Description' }
      ],
      fields: [
        { key: 'API_KEY', label: 'API Key', type: 'password', required: true }
      ]
    }

    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'mnemo-mcp', schema }),
    })

    const setupUrl = `${relay.url}/mnemo/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    await page.fill('#API_KEY', 'test-api-key')
    await page.click('#submit-btn')

    await expect(page.locator('.status-info')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('#setup-form')).not.toBeVisible()
  })

  test('mnemo setup error handling', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')

    const schema = {
      fields: [
        { key: 'API_KEY', label: 'API Key', type: 'password', required: true }
      ]
    }

    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'mnemo-mcp', schema }),
    })

    const setupUrl = `${relay.url}/mnemo/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // Intercept and mock failure
    await page.route(`**/api/sessions/${sessionId}/result`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'text/plain',
        body: 'Server exploded',
      })
    })

    await page.fill('#API_KEY', 'test-api-key')
    const submitBtn = page.locator('#submit-btn')
    await submitBtn.click()

    // Expect error message
    const errorStatus = page.locator('.status-error')
    await expect(errorStatus).toBeVisible({ timeout: 10_000 })
    await expect(errorStatus).toContainText('Submit failed (500): Server exploded')

    // Expect button to be re-enabled
    await expect(submitBtn).toBeEnabled()
    await expect(submitBtn).toHaveText('Encrypt & Send')
  })
})
