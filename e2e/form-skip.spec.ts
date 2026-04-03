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

test.describe('Form Skip E2E', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  const formConfigs = [
    { name: 'wet', path: '/wet/index.html', successMsg: 'Setup skipped. Using local ONNX models.', needsMockSession: true },
    { name: 'mnemo', path: '/mnemo/index.html', successMsg: 'Setup skipped. Using local ONNX models.', needsMockSession: true },
    { name: 'email', path: '/email/index.html', successMsg: 'Setup skipped. Server will use default settings.', needsMockSession: false },
    { name: 'telegram', path: '/telegram/index.html', successMsg: 'Setup skipped. Server will use default settings.', needsMockSession: false },
    { name: 'notion', path: '/notion/index.html', successMsg: 'Setup skipped. Server will use default settings.', needsMockSession: true },
    { name: 'code-review-graph', path: '/code-review-graph/index.html', successMsg: 'Setup skipped. Using local ONNX models.', needsMockSession: true },
  ]

  for (const config of formConfigs) {
    test(`${config.name} successful skip: UI updates correctly`, async ({ page }) => {
      const keyPair = await generateKeyPair()
      const pubKey = await exportPublicKey(keyPair.publicKey)
      const passphrase = generatePassphrase()
      const sessionId = `test-skip-success-${config.name}`

      if (config.needsMockSession) {
        // Intercept initial session fetch if the form makes one
        await page.route(`**/api/sessions/${sessionId}`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ sessionId, serverName: config.name, schema: { fields: [] } }),
          })
        })
      }

      // Create real session for forms that don't fetch it explicitly (or just in case)
      await fetch(`${relay.url}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, serverName: config.name, schema: { fields: [] } }),
      })

      const setupUrl = `${relay.url}${config.path}?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
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
      await expect(page.locator('.status-info')).toContainText(config.successMsg)
      // Verify form hidden
      await expect(page.locator('#setup-form')).toBeHidden()
    })

    test(`${config.name} failed skip (HTTP 500): UI shows error and resets button`, async ({ page }) => {
      const keyPair = await generateKeyPair()
      const pubKey = await exportPublicKey(keyPair.publicKey)
      const passphrase = generatePassphrase()
      const sessionId = `test-skip-fail-500-${config.name}`

      if (config.needsMockSession) {
        await page.route(`**/api/sessions/${sessionId}`, async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ sessionId, serverName: config.name, schema: { fields: [] } }),
          })
        })
      }

      await fetch(`${relay.url}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, serverName: config.name, schema: { fields: [] } }),
      })

      const setupUrl = `${relay.url}${config.path}?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
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
      // Verify form still visible
      await expect(page.locator('#setup-form')).toBeVisible()
    })
  }
})
