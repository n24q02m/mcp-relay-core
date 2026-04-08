import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encrypt } from '../../src/crypto/aes.js'
import { deriveSharedSecret, exportPublicKey, generateKeyPair } from '../../src/crypto/ecdh.js'
import { deriveAesKey } from '../../src/crypto/kdf.js'
import { createSession, generatePassphrase, pollForResult, type RelaySession } from '../../src/relay/client.js'
import { WORDLIST } from '../../src/relay/wordlist.js'
import type { RelayConfigSchema } from '../../src/schema/types.js'

describe('WORDLIST', () => {
  it('should contain exactly 7776 words', () => {
    expect(WORDLIST.length).toBe(7776)
  })

  it('should contain only non-empty lowercase strings (may include hyphens)', () => {
    for (const word of WORDLIST) {
      expect(word).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })

  it('should have no duplicates', () => {
    const unique = new Set(WORDLIST)
    expect(unique.size).toBe(WORDLIST.length)
  })
})

describe('generatePassphrase', () => {
  it('should return 4 words separated by hyphens by default', () => {
    const passphrase = generatePassphrase()
    // We can't simply split by '-' because some words contain hyphens
    // But we know it should contain at least 4 words
    let count = 0
    let remaining = passphrase
    const sortedWords = [...WORDLIST].sort((a, b) => b.length - a.length)
    for (const word of sortedWords) {
      while (remaining.includes(word)) {
        remaining = remaining.replace(word, '')
        count++
      }
    }
    expect(count).toBeGreaterThanOrEqual(4)
  })

  it('should respect custom word count', () => {
    const passphrase = generatePassphrase(6)
    let count = 0
    let remaining = passphrase
    const sortedWords = [...WORDLIST].sort((a, b) => b.length - a.length)
    for (const word of sortedWords) {
      while (remaining.includes(word)) {
        remaining = remaining.replace(word, '')
        count++
      }
    }
    expect(count).toBeGreaterThanOrEqual(6)
  })

  it('should only use words from the WORDLIST', () => {
    const _wordSet = new Set(WORDLIST)
    const sortedWords = [...WORDLIST].sort((a, b) => b.length - a.length)
    for (let i = 0; i < 20; i++) {
      const passphrase = generatePassphrase()
      let remaining = passphrase
      for (const word of sortedWords) {
        while (remaining.includes(word)) {
          // Remove word AND a neighboring hyphen if present
          const idx = remaining.indexOf(word)
          let toRemove = word
          if (remaining[idx + word.length] === '-') {
            toRemove += '-'
          } else if (remaining[idx - 1] === '-') {
            toRemove = `-${word}`
          }
          remaining = remaining.replace(toRemove, '')
        }
      }
      expect(remaining).toBe('')
    }
  })

  it('should produce different passphrases on successive calls', () => {
    const results = new Set<string>()
    for (let i = 0; i < 10; i++) {
      results.add(generatePassphrase())
    }
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('createSession', () => {
  const relayUrl = 'https://relay.example.com'
  const serverName = 'test-server'
  const schema: RelayConfigSchema = {
    server: 'test-server',
    displayName: 'Test Server',
    fields: [{ key: 'token', label: 'Token', type: 'password', required: true }]
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should call POST /api/sessions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sessionId: 'test-id' })
    } as Response)

    await createSession(relayUrl, serverName, schema)

    expect(fetch).toHaveBeenCalledWith(`${relayUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining(serverName)
    })
  })

  it('should return session with valid relayUrl containing fragment', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ sessionId: 'test-id' })
    } as Response)

    const session = await createSession(relayUrl, serverName, schema)
    // The sessionId is generated randomly in createSession, so it won't be 'test-id'
    expect(session.sessionId).toHaveLength(64)
    expect(session.relayUrl).toContain(`${relayUrl}/setup?s=${session.sessionId}`)
    expect(session.relayUrl).toContain('#k=')
    expect(session.relayUrl).toContain('&p=')
  })

  it('should throw on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500
    } as Response)

    await expect(createSession(relayUrl, serverName, schema)).rejects.toThrow('500')
  })
})

describe('pollForResult', () => {
  const relayUrl = 'https://relay.example.com'
  let session: RelaySession

  beforeEach(async () => {
    const keyPair = await generateKeyPair()
    session = {
      sessionId: 'test-id',
      keyPair,
      passphrase: 'one-two-three-four',
      relayUrl: '...'
    }
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should decrypt and return credentials on 200', async () => {
    const browserKeyPair = await generateKeyPair()
    const sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, session.keyPair.publicKey)
    const aesKey = await deriveAesKey(sharedSecret, session.passphrase)
    const credentials = { token: 'secret-123' }
    const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(credentials))

    const browserPub = await exportPublicKey(browserKeyPair.publicKey)

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        browserPub,
        ciphertext: Buffer.from(ciphertext).toString('base64'),
        iv: Buffer.from(iv).toString('base64'),
        tag: Buffer.from(tag).toString('base64')
      })
    } as Response)

    const result = await pollForResult(relayUrl, session, 10, 100)
    expect(result).toEqual(credentials)
  })

  it('should handle cleanup failure gracefully and throw RELAY_SKIPPED when status is skipped', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'skipped' })
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    await expect(pollForResult(relayUrl, session, 10, 100)).rejects.toThrow('RELAY_SKIPPED')
  })

  it('should throw on 404 (session expired)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404
    } as Response)

    await expect(pollForResult(relayUrl, session, 10, 100)).rejects.toThrow('Session expired')
  })

  it('should throw on unexpected status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 418
    } as Response)

    await expect(pollForResult(relayUrl, session, 10, 100)).rejects.toThrow('Unexpected status: 418')
  })

  it('should poll and timeout after deadline', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 202
    } as Response)

    await expect(pollForResult(relayUrl, session, 10, 50)).rejects.toThrow('timed out')
  })

  it('should poll multiple times with 202 then succeed on 200', async () => {
    const browserKeyPair = await generateKeyPair()
    const sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, session.keyPair.publicKey)
    const aesKey = await deriveAesKey(sharedSecret, session.passphrase)
    const credentials = { token: 'secret-123' }
    const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(credentials))
    const browserPub = await exportPublicKey(browserKeyPair.publicKey)

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, status: 202 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 202 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          browserPub,
          ciphertext: Buffer.from(ciphertext).toString('base64'),
          iv: Buffer.from(iv).toString('base64'),
          tag: Buffer.from(tag).toString('base64')
        })
      } as Response)

    const result = await pollForResult(relayUrl, session, 10, 500)
    expect(result).toEqual(credentials)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
