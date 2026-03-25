/**
 * Generate cross-language crypto test vectors.
 *
 * Usage: bun scripts/gen-vectors.ts
 *
 * Produces packages/core-ts/tests/fixtures/crypto-vectors.json
 * with deterministic outputs that Python (and other languages) must reproduce.
 *
 * WARNING: Uses a fixed IV of all zeros — acceptable ONLY for test vectors.
 * Never use a fixed IV in production.
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const INFO = new TextEncoder().encode('mcp-relay')

async function main() {
  // Fixed inputs
  const sharedSecret = new Uint8Array(32).fill(0x0b)
  const passphrase = 'correct-horse-battery-staple'
  const plaintext = 'hello from mcp-relay test vectors'
  const fixedIv = new Uint8Array(12) // all zeros — TEST ONLY

  // Derive key via HKDF-SHA256
  const salt = new TextEncoder().encode(passphrase)
  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: INFO },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )

  // Export derived key
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey))
  const derivedKeyHex = Buffer.from(rawKey).toString('hex')

  // Encrypt with fixed IV
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: fixedIv }, aesKey, encoded)
  const combined = new Uint8Array(encrypted)
  const ciphertext = combined.slice(0, combined.length - 16)
  const tag = combined.slice(combined.length - 16)

  const vectors = {
    _comment: 'Cross-language crypto test vectors for mcp-relay. DO NOT use fixed IVs in production.',
    hkdf: {
      shared_secret_hex: Buffer.from(sharedSecret).toString('hex'),
      passphrase,
      info: 'mcp-relay',
      derived_key_hex: derivedKeyHex,
    },
    aes_gcm: {
      plaintext,
      iv_hex: Buffer.from(fixedIv).toString('hex'),
      ciphertext_hex: Buffer.from(ciphertext).toString('hex'),
      tag_hex: Buffer.from(tag).toString('hex'),
    },
  }

  const outPath = resolve(import.meta.dirname ?? '.', '..', 'packages', 'core-ts', 'tests', 'fixtures', 'crypto-vectors.json')
  writeFileSync(outPath, `${JSON.stringify(vectors, null, 2)}\n`)
  console.log(`Wrote ${outPath}`)
  console.log(JSON.stringify(vectors, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
