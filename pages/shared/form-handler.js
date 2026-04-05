import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from '/shared/crypto.js'
import { getSessionId, parseFragment, submitResult } from '/shared/relay-client.js'
import { showStatus, startMessagePolling } from '/shared/ui.js'

/**
 * Common setup for relay forms (fragment parsing, ECDH, encryption, submit, poll).
 * @param {object} options
 * @param {function} options.onCollect - Async function returning the config object to encrypt.
 * @param {string} [options.successMsg] - Message to show on successful submit.
 */
export async function setupForm({ onCollect, successMsg }) {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()

  const statusContainer = document.getElementById('status-container')
  const submitBtn = document.getElementById('submit-btn')
  const setupForm = document.getElementById('setup-form')

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
    return { sessionId: null }
  }

  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = await onCollect()
      if (!config) {
        submitBtn.disabled = false
        submitBtn.textContent = 'Encrypt & Send'
        return
      }

      let cliPubKey, browserKeyPair, sharedSecret, aesKey
      try {
        cliPubKey = await importPublicKey(cliPubKeyB64)
      } catch (e) {
        throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${e.name || e.message}`)
      }
      try {
        browserKeyPair = await generateKeyPair()
      } catch (e) {
        throw new Error(`Key generation failed: ${e.name || e.message}`)
      }
      try {
        sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      } catch (e) {
        throw new Error(`Key exchange failed: ${e.name || e.message}`)
      }
      try {
        aesKey = await deriveAesKey(sharedSecret, passphrase)
      } catch (e) {
        throw new Error(`Key derivation failed: ${e.name || e.message}`)
      }

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (result.ok) {
        setupForm.style.display = 'none'
        showStatus(statusContainer, successMsg || 'Credentials sent. Waiting for server...', 'success')
        startMessagePolling(sessionId, statusContainer)
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown encryption error'
      console.error('Relay submit error:', err)
      showStatus(statusContainer, `Error: ${msg}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  return { sessionId, cliPubKeyB64, passphrase }
}

/**
 * Common skip button logic.
 * @param {string} sessionId
 * @param {object} options
 * @param {string} [options.label] - Button label.
 * @param {string} [options.skipMsg] - Status message on skip.
 */
export function setupSkipButton(sessionId, { label = 'Skip Setup (use defaults)', skipMsg = 'Setup skipped.' } = {}) {
  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = label
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'

  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(document.getElementById('status-container'), skipMsg, 'info')
        document.getElementById('setup-form').style.display = 'none'
      } else {
        throw new Error(`Skip failed: ${response.status}`)
      }
    } catch (err) {
      showStatus(document.getElementById('status-container'), err.message || String(err), 'error')
      skipBtn.disabled = false
      skipBtn.textContent = label
    }
  })

  document.getElementById('setup-form').appendChild(skipBtn)
}
