import { toBase64 } from './crypto.js'

// Parse URL fragment: #k=<pubkey>&p=<passphrase>
// Fragment is never sent to the server (RFC 3986)
export function parseFragment() {
  const hash = window.location.hash.slice(1) // remove #
  const params = new URLSearchParams(hash)
  return {
    publicKey: params.get('k'),
    passphrase: decodeURIComponent(params.get('p') || ''),
  }
}

// Get session ID from query: ?s=<sessionId>
export function getSessionId() {
  return new URLSearchParams(window.location.search).get('s')
}

// Submit encrypted credentials to relay (with retry for Cloudflare challenges)
export async function submitResult(sessionId, browserPub, ciphertext, iv, tag) {
  const body = JSON.stringify({
    browserPub,
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    tag: toBase64(tag),
  })

  const maxRetries = 3
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(`/api/sessions/${sessionId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    if (response.ok) return { ok: true }

    const text = await response.text().catch(() => '')
    // Retry on 403/503 (Cloudflare challenge) or 429 (rate limit)
    if ((response.status === 403 || response.status === 503 || response.status === 429) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 1000 * attempt))
      continue
    }
    return { ok: false, status: response.status, error: text }
  }
  return { ok: false, status: 0, error: 'Max retries exceeded' }
}
