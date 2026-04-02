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

test.describe('Wet Skip Form E2E', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('successful skip: UI updates correctly', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = 'test-skip-success'

    // Create session
    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'wet-mcp', schema: {} }),
    })

    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // Intercept skip request and return success
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      })
    })

    await page.click('#skip-btn')

    // Verify success message
    await expect(page.locator('.status-info')).toContainText('Setup skipped. Using local ONNX models.')
    // Verify form hidden
    await expect(page.locator('#setup-form')).toBeHidden()
  })

  test('failed skip (HTTP 500): UI shows error and resets button', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = 'test-skip-fail-500'

    // Create session
    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'wet-mcp', schema: {} }),
    })

    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // Intercept skip request and return 500
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    const skipBtn = page.locator('#skip-btn')
    await skipBtn.click()

    // Verify error message
    await expect(page.locator('.status-error')).toContainText('Skip failed (500)')
    // Verify button reset
    await expect(skipBtn).toBeEnabled()
    await expect(skipBtn).toHaveText('Skip (use local mode)')
    // Verify form still visible
    await expect(page.locator('#setup-form')).toBeVisible()
  })

  test('failed skip (Network Error): UI shows error and resets button', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = 'test-skip-fail-network'

    // Create session
    await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'wet-mcp', schema: {} }),
    })

    const setupUrl = `${relay.url}/wet/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // Intercept skip request and abort it
    await page.route(`**/api/sessions/${sessionId}/skip`, async (route) => {
      await route.abort('failed')
    })

    const skipBtn = page.locator('#skip-btn')
    await skipBtn.click()

    // Verify error message (browsers usually throw TypeError for failed fetch)
    await expect(page.locator('.status-error')).toBeVisible()
    // Verify button reset
    await expect(skipBtn).toBeEnabled()
    await expect(skipBtn).toHaveText('Skip (use local mode)')
  })
})
