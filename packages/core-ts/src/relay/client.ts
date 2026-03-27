import { generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret } from '../crypto/ecdh.js'
import { deriveAesKey } from '../crypto/kdf.js'
import { decrypt } from '../crypto/aes.js'
import type { RelayConfigSchema } from '../schema/types.js'
import { WORDLIST } from './wordlist.js'

export function generatePassphrase(wordCount = 4): string {
  const words: string[] = []
  const max = Math.floor(0x10000 / WORDLIST.length) * WORDLIST.length // rejection threshold
  for (let i = 0; i < wordCount; i++) {
    let index: number
    do {
      index = crypto.getRandomValues(new Uint16Array(1))[0]
    } while (index >= max) // reject biased values
    words.push(WORDLIST[index % WORDLIST.length])
  }
  return words.join('-')
}

export interface RelaySession {
  sessionId: string
  keyPair: CryptoKeyPair
  passphrase: string
  relayUrl: string
}

export async function createSession(
  relayBaseUrl: string,
  serverName: string,
  schema: RelayConfigSchema,
): Promise<RelaySession> {
  const sessionId = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex')
  const keyPair = await generateKeyPair()
  const passphrase = generatePassphrase()

  const response = await fetch(`${relayBaseUrl}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, serverName, schema }),
  })
  if (!response.ok) throw new Error(`Relay session creation failed: ${response.status}`)

  const pubKeyBase64 = await exportPublicKey(keyPair.publicKey)
  const relayUrl = `${relayBaseUrl}/setup?s=${sessionId}#k=${pubKeyBase64}&p=${encodeURIComponent(passphrase)}`

  return { sessionId, keyPair, passphrase, relayUrl }
}

export async function pollForResult(
  relayBaseUrl: string,
  session: RelaySession,
  intervalMs = 2000,
  timeoutMs = 600_000,
): Promise<Record<string, string>> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const response = await fetch(`${relayBaseUrl}/api/sessions/${session.sessionId}`)
    if (response.status === 200) {
      const { browserPub, ciphertext, iv, tag } = await response.json()

      const browserKey = await importPublicKey(browserPub)
      const sharedSecret = await deriveSharedSecret(session.keyPair.privateKey, browserKey)
      const aesKey = await deriveAesKey(sharedSecret, session.passphrase)
      const plaintext = await decrypt(
        aesKey,
        new Uint8Array(Buffer.from(ciphertext, 'base64')),
        new Uint8Array(Buffer.from(iv, 'base64')),
        new Uint8Array(Buffer.from(tag, 'base64')),
      )

      // Cleanup session
      await fetch(`${relayBaseUrl}/api/sessions/${session.sessionId}`, { method: 'DELETE' }).catch(
        () => {},
      )

      return JSON.parse(plaintext)
    }
    if (response.status === 404) throw new Error('Session expired or not found')
    if (response.status !== 202) throw new Error(`Unexpected status: ${response.status}`)

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  throw new Error('Relay setup timed out')
}
