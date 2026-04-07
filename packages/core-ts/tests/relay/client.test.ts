import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSession, generatePassphrase } from '../../src/relay/client.js'
import { WORDLIST } from '../../src/relay/wordlist.js'
import type { RelayConfigSchema } from '../../src/schema/types.js'

describe('generatePassphrase', () => {
  it('should return 4 words separated by hyphens by default', () => {
    const passphrase = generatePassphrase()
    const words = passphrase.split('-')
    expect(words.length).toBeGreaterThanOrEqual(4)
  })

  it('should respect custom word count', () => {
    const passphrase = generatePassphrase(6)
    expect(passphrase.split('-').length).toBeGreaterThanOrEqual(6)
  })

  it('should only use words from the WORDLIST', () => {
    for (let i = 0; i < 50; i++) {
      const passphrase = generatePassphrase()
      let remaining = passphrase
      let count = 0
      while (remaining.length > 0) {
        let found = false
        for (const word of WORDLIST) {
          if (remaining === word) {
            count++
            remaining = ''
            found = true
            break
          } else if (remaining.startsWith(`${word}-`)) {
            count++
            remaining = remaining.slice(word.length + 1)
            found = true
            break
          }
        }
        if (!found) {
          throw new Error(`Passphrase component not found in WORDLIST: ${passphrase}`)
        }
      }
      expect(count).toBe(4)
    }
  })

  it('should produce different passphrases on successive calls', () => {
    const results = new Set<string>()
    for (let i = 0; i < 10; i++) {
      results.add(generatePassphrase())
    }
    expect(results.size).toBe(10)
  })
})

describe('createSession', () => {
  const relayBaseUrl = 'https://relay.example.com'
  const serverName = 'test-server'
  const schema: RelayConfigSchema = {
    server: 'test-server',
    displayName: 'Test Server',
    fields: [{ key: 'apiKey', label: 'API Key', type: 'text', required: true }]
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should call POST /api/sessions', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending' })
    } as Response)

    await createSession(relayBaseUrl, serverName, schema)

    expect(mockFetch).toHaveBeenCalledWith(
      `${relayBaseUrl}/api/sessions`,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining(serverName)
      })
    )
  })

  it('should return session with valid relayUrl containing fragment', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'pending' })
    } as Response)

    const session = await createSession(relayBaseUrl, serverName, schema)

    expect(session.sessionId).toHaveLength(64) // hex encoded 32 bytes
    expect(session.relayUrl).toContain(`${relayBaseUrl}/setup?s=${session.sessionId}#k=`)
    expect(session.relayUrl).toContain('&p=')
  })

  it('should throw on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    } as Response)

    await expect(createSession(relayBaseUrl, serverName, schema)).rejects.toThrow('Relay session creation failed: 500')
  })
})
