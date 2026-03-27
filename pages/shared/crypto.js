// Browser-side ECDH + HKDF + AES-GCM using WebCrypto API
// Must produce IDENTICAL output to packages/core-ts/src/crypto/ for same inputs

const ALGORITHM = { name: 'ECDH', namedCurve: 'P-256' }

export async function generateKeyPair() {
  return crypto.subtle.generateKey(ALGORITHM, true, ['deriveKey', 'deriveBits'])
}

export async function exportPublicKey(key) {
  const raw = await crypto.subtle.exportKey('raw', key)
  return toBase64url(new Uint8Array(raw))
}

export async function importPublicKey(base64url) {
  const raw = fromBase64url(base64url)
  return crypto.subtle.importKey('raw', raw, ALGORITHM, true, [])
}

export async function deriveSharedSecret(privateKey, publicKey) {
  return crypto.subtle.deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
}

export async function deriveAesKey(sharedSecret, passphrase) {
  const salt = new TextEncoder().encode(passphrase)
  const info = new TextEncoder().encode('mcp-relay')
  const keyMaterial = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
}

export async function encrypt(key, plaintext) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  // WebCrypto appends 16-byte GCM tag to ciphertext
  const combined = new Uint8Array(encrypted)
  const ciphertext = combined.slice(0, combined.length - 16)
  const tag = combined.slice(combined.length - 16)

  return { ciphertext, iv, tag }
}

// --- Base64url helpers (browser-compatible, no Buffer) ---

export function toBase64(uint8) {
  let result = ''
  const len = uint8.length
  // 32768 is a safe chunk size for String.fromCharCode.apply in browsers
  for (let i = 0; i < len; i += 32768) {
    result += String.fromCharCode.apply(null, uint8.subarray(i, i + 32768))
  }
  return btoa(result)
}

function toBase64url(uint8) {
  return toBase64(uint8)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const BASE64_LOOKUP = new Uint8Array(256)
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i
}

function fromBase64url(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  // Pure JS decoder — avoids browser atob quirks (Brave, etc.)
  const len = padded.length
  let bufferLength = len * 0.75
  if (padded[len - 1] === '=') bufferLength--
  if (padded[len - 2] === '=') bufferLength--

  const bytes = new Uint8Array(bufferLength)
  let p = 0
  for (let i = 0; i < len; i += 4) {
    const a = BASE64_LOOKUP[padded.charCodeAt(i)]
    const b = BASE64_LOOKUP[padded.charCodeAt(i + 1)]
    const c = BASE64_LOOKUP[padded.charCodeAt(i + 2)]
    const d = BASE64_LOOKUP[padded.charCodeAt(i + 3)]

    bytes[p++] = (a << 2) | (b >> 4)
    if (padded[i + 2] !== '=') bytes[p++] = ((b & 15) << 4) | (c >> 2)
    if (padded[i + 3] !== '=') bytes[p++] = ((c & 3) << 6) | d
  }
  return bytes
}