import { test, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { startLocalRelay } from '../packages/relay-server/src/local.ts'
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedSecret,
} from '../packages/core-ts/src/crypto/ecdh.ts'
import { deriveAesKey } from '../packages/core-ts/src/crypto/kdf.ts'
import { decrypt } from '../packages/core-ts/src/crypto/aes.ts'
import { generatePassphrase } from '../packages/core-ts/src/relay/client.ts'

const rootDir = resolve(process.cwd())
const pagesDir = resolve(rootDir, 'pages')
const vectorsPath = resolve(rootDir, 'packages/core-ts/tests/fixtures/crypto-vectors.json')

// ---------------------------------------------------------------------------
// Relay Flow E2E
// ---------------------------------------------------------------------------

test.describe('Relay Flow E2E', () => {
  let relay: { port: number; url: string; close: () => void }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('full relay flow: CLI generates session -> browser encrypts -> CLI decrypts', async ({
    page,
  }) => {
    // 1. CLI side: generate keypair + passphrase + session
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')

    // 2. Create session on relay
    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'better-telegram-mcp', schema: {} }),
    })
    expect(createRes.status).toBe(201)

    // 3. Verify session is pending
    const pollRes1 = await fetch(`${relay.url}/api/sessions/${sessionId}`)
    expect(pollRes1.status).toBe(202)

    // 4. Open Telegram relay page in browser with fragment
    const setupUrl = `${relay.url}/telegram/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)

    // 5. Select Bot mode, fill in token
    await page.click('[data-mode-id="bot"]')
    await page.fill('#TELEGRAM_BOT_TOKEN', '123456:ABC-DEF-test-token')
    await page.click('#submit-btn')

    // 6. Wait for info message indicating credentials sent
    await expect(page.locator('.status-info')).toBeVisible({ timeout: 10_000 })

    // 7. CLI side: poll for result and decrypt
    const pollRes2 = await fetch(`${relay.url}/api/sessions/${sessionId}`)
    expect(pollRes2.status).toBe(200)
    const body = (await pollRes2.json()) as {
      result: { browserPub: string; ciphertext: string; iv: string; tag: string }
    }
    const { browserPub, ciphertext, iv, tag } = body.result

    // Decrypt
    const browserKey = await importPublicKey(browserPub)
    const sharedSecret = await deriveSharedSecret(keyPair.privateKey, browserKey)
    const aesKey = await deriveAesKey(sharedSecret, passphrase)
    const plaintext = await decrypt(
      aesKey,
      new Uint8Array(Buffer.from(ciphertext, 'base64')),
      new Uint8Array(Buffer.from(iv, 'base64')),
      new Uint8Array(Buffer.from(tag, 'base64')),
    )
    const config = JSON.parse(plaintext) as Record<string, string>
    expect(config.TELEGRAM_BOT_TOKEN).toBe('123456:ABC-DEF-test-token')
  })

  test('session is one-shot: second submission rejected', async ({ page }) => {
    const keyPair = await generateKeyPair()
    const pubKey = await exportPublicKey(keyPair.publicKey)
    const passphrase = generatePassphrase()
    const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')

    // Create session
    const createRes = await fetch(`${relay.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, serverName: 'better-telegram-mcp', schema: {} }),
    })
    expect(createRes.status).toBe(201)

    // First submission via browser
    const setupUrl = `${relay.url}/telegram/index.html?s=${sessionId}#k=${pubKey}&p=${encodeURIComponent(passphrase)}`
    await page.goto(setupUrl)
    await page.click('[data-mode-id="bot"]')
    await page.fill('#TELEGRAM_BOT_TOKEN', 'first-token')
    await page.click('#submit-btn')
    await expect(page.locator('.status-info')).toBeVisible({ timeout: 10_000 })

    // Second submission via API (simulating another browser attempt)
    const secondRes = await fetch(`${relay.url}/api/sessions/${sessionId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        browserPub: 'dummy',
        ciphertext: 'dummy',
        iv: 'dummy',
        tag: 'dummy',
      }),
    })
    expect(secondRes.status).toBe(409)
  })

  test('non-existent session returns 404', async () => {
    const fakeId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')
    const res = await fetch(`${relay.url}/api/sessions/${fakeId}`)
    expect(res.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// WebCrypto Parity
// ---------------------------------------------------------------------------

test.describe('WebCrypto Parity', () => {
  let relay: { port: number; url: string; close: () => void }
  const vectors = JSON.parse(readFileSync(vectorsPath, 'utf-8')) as {
    hkdf: { shared_secret_hex: string; passphrase: string; derived_key_hex: string }
    aes_gcm: { plaintext: string; iv_hex: string; ciphertext_hex: string; tag_hex: string }
  }

  test.beforeAll(async () => {
    relay = await startLocalRelay(pagesDir)
  })

  test.afterAll(() => {
    relay?.close()
  })

  test('browser WebCrypto produces same HKDF output as Node.js', async ({ page }) => {
    // Navigate to any page so we have a browser context with WebCrypto
    await page.goto(`${relay.url}/telegram/index.html`)

    const { shared_secret_hex, passphrase, derived_key_hex } = vectors.hkdf

    const browserDerivedHex = await page.evaluate(
      async ({ sharedSecretHex, pass }: { sharedSecretHex: string; pass: string }) => {
        const hexToBytes = (hex: string) => {
          const arr = new Uint8Array(hex.length / 2)
          for (let i = 0; i < hex.length; i += 2) {
            arr[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
          }
          return arr
        }

        const bytesToHex = (buf: ArrayBuffer) =>
          [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

        const sharedSecret = hexToBytes(sharedSecretHex).buffer
        const salt = new TextEncoder().encode(pass)
        const info = new TextEncoder().encode('mcp-relay')

        const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, [
          'deriveKey',
        ])

        const aesKey = await crypto.subtle.deriveKey(
          { name: 'HKDF', hash: 'SHA-256', salt, info },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt'],
        )

        const raw = await crypto.subtle.exportKey('raw', aesKey)
        return bytesToHex(raw)
      },
      { sharedSecretHex: shared_secret_hex, pass: passphrase },
    )

    expect(browserDerivedHex).toBe(derived_key_hex)

    // Also verify Node.js side produces the same
    // Use Uint8Array to avoid Buffer's shared ArrayBuffer offset issues
    const sharedSecretBytes = new Uint8Array(Buffer.from(shared_secret_hex, 'hex'))
    const aesKey = await deriveAesKey(sharedSecretBytes.buffer, passphrase)
    const rawKey = await crypto.subtle.exportKey('raw', aesKey)
    const nodeDerivedHex = Buffer.from(rawKey).toString('hex')
    expect(nodeDerivedHex).toBe(derived_key_hex)

    // Parity: browser === Node.js
    expect(browserDerivedHex).toBe(nodeDerivedHex)
  })

  test('browser AES-GCM produces same output as Node.js for fixed IV', async ({ page }) => {
    await page.goto(`${relay.url}/telegram/index.html`)

    const { plaintext, iv_hex, ciphertext_hex, tag_hex } = vectors.aes_gcm
    const { derived_key_hex } = vectors.hkdf

    const browserResult = await page.evaluate(
      async ({ keyHex, ivHex, plain }: { keyHex: string; ivHex: string; plain: string }) => {
        const hexToBytes = (hex: string) => {
          const arr = new Uint8Array(hex.length / 2)
          for (let i = 0; i < hex.length; i += 2) {
            arr[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
          }
          return arr
        }

        const bytesToHex = (buf: Uint8Array) =>
          [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')

        const keyData = hexToBytes(keyHex)
        const iv = hexToBytes(ivHex)

        const key = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt'])

        const encoded = new TextEncoder().encode(plain)
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

        const combined = new Uint8Array(encrypted)
        const ct = combined.slice(0, combined.length - 16)
        const tag = combined.slice(combined.length - 16)

        return {
          ciphertext: bytesToHex(ct),
          tag: bytesToHex(tag),
        }
      },
      { keyHex: derived_key_hex, ivHex: iv_hex, plain: plaintext },
    )

    expect(browserResult.ciphertext).toBe(ciphertext_hex)
    expect(browserResult.tag).toBe(tag_hex)

    // Also verify Node.js produces the same
    const keyData = Buffer.from(derived_key_hex, 'hex')
    const iv = Buffer.from(iv_hex, 'hex')
    const nodeKey = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt'])
    const encoded = new TextEncoder().encode(plaintext)
    const nodeEncrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, nodeKey, encoded)
    const nodeCombined = new Uint8Array(nodeEncrypted)
    const nodeCt = Buffer.from(nodeCombined.slice(0, nodeCombined.length - 16)).toString('hex')
    const nodeTag = Buffer.from(nodeCombined.slice(nodeCombined.length - 16)).toString('hex')

    expect(nodeCt).toBe(ciphertext_hex)
    expect(nodeTag).toBe(tag_hex)

    // Parity
    expect(browserResult.ciphertext).toBe(nodeCt)
    expect(browserResult.tag).toBe(nodeTag)
  })
})
