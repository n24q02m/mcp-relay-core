import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from './crypto.js'
import { submitResult } from './relay-client.js'
import { showStatus, startMessagePolling } from './ui.js'

/**
 * Common form submission logic with encryption and polling.
 */
export function setupForm({
  formId = 'setup-form',
  submitBtnId = 'submit-btn',
  statusContainerId = 'status-container',
  sessionId,
  cliPubKeyB64,
  passphrase,
  onCollect
}) {
  const form = document.getElementById(formId)
  const submitBtn = document.getElementById(submitBtnId)
  const statusContainer = document.getElementById(statusContainerId)

  if (!form || !submitBtn || !statusContainer) return

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    const originalText = submitBtn.textContent
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = await onCollect()
      if (!config) {
        submitBtn.disabled = false
        submitBtn.textContent = originalText
        return
      }

      // Step-by-step crypto
      let cliPubKey, browserKeyPair, sharedSecret, aesKey
      try {
        cliPubKey = await importPublicKey(cliPubKeyB64)
      } catch (err) {
        throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${err.name || err.message}`)
      }

      try {
        browserKeyPair = await generateKeyPair()
      } catch (err) {
        throw new Error(`Key generation failed: ${err.name || err.message}`)
      }

      try {
        sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      } catch (err) {
        throw new Error(`Key exchange failed: ${err.name || err.message}`)
      }

      try {
        aesKey = await deriveAesKey(sharedSecret, passphrase)
      } catch (err) {
        throw new Error(`Key derivation failed: ${err.name || err.message}`)
      }

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (result.ok) {
        form.style.display = 'none'
        // Compatibility with existing tests: tests expect a visible .status-success after submission.
        // In the real UI, this is followed by polling.
        showStatus(statusContainer, 'Credentials sent. Waiting for server to complete setup...', 'success')

        startMessagePolling(sessionId, statusContainer)
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown error'
      console.error('Relay submit error:', err)
      showStatus(statusContainer, `Error: ${msg}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = originalText
    }
  })
}

/**
 * Common skip button logic.
 */
export function setupSkipButton({
  formId = 'setup-form',
  statusContainerId = 'status-container',
  sessionId,
  text = 'Skip Setup (use defaults)',
  skipMessage = 'Setup skipped. Server will use default settings.'
}) {
  const form = document.getElementById(formId)
  const statusContainer = document.getElementById(statusContainerId)
  if (!form || !statusContainer) return

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = text
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'

  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    const originalText = skipBtn.textContent
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(statusContainer, skipMessage, 'info')
        form.style.display = 'none'
      } else {
        throw new Error('Skip failed')
      }
    } catch (_err) {
      skipBtn.disabled = false
      skipBtn.textContent = originalText
    }
  })
  form.appendChild(skipBtn)
}
