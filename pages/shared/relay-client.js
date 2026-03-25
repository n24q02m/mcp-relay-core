import { toBase64 } from './crypto.js'

// Parse URL fragment: #k=<pubkey>&p=<passphrase>
// Fragment is never sent to the server (RFC 3986)
export function parseFragment() {
  const hash = window.location.hash.slice(1) // remove #
  const params = new URLSearchParams(hash)
  return {
    publicKey: params.get('k'),
    passphrase: decodeURIComponent(params.get('p') || '')
  }
}

// Get session ID from query: ?s=<sessionId>
export function getSessionId() {
  return new URLSearchParams(window.location.search).get('s')
}

// Submit encrypted credentials to relay
export async function submitResult(sessionId, browserPub, ciphertext, iv, tag) {
  const response = await fetch(`/api/sessions/${sessionId}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      browserPub,
      ciphertext: toBase64(ciphertext),
      iv: toBase64(iv),
      tag: toBase64(tag)
    })
  })
  return response.ok
}
