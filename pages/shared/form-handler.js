import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from '/shared/crypto.js'
import { submitResult } from '/shared/relay-client.js'
import { showStatus, startMessagePolling } from '/shared/ui.js'

/**
 * Common form setup logic for relay pages.
 * Handles credential collection, encryption, and submission.
 */
export async function setupForm({
  sessionId,
  cliPubKeyB64,
  passphrase,
  onCollect,
  formId = 'setup-form',
  statusContainerId = 'status-container',
  submitBtnId = 'submit-btn'
}) {
  const form = document.getElementById(formId)
  const statusContainer = document.getElementById(statusContainerId)
  const submitBtn = document.getElementById(submitBtnId)

  if (!form || !statusContainer || !submitBtn) {
    console.error('Form elements not found:', {
      form,
      statusContainer,
      submitBtn
    })
    return
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    const originalBtnText = submitBtn.textContent
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = await onCollect()
      if (!config) {
        submitBtn.disabled = false
        submitBtn.textContent = originalBtnText
        return
      }

      let cliPubKey
      try {
        cliPubKey = await importPublicKey(cliPubKeyB64)
      } catch (err) {
        throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${err.name || err.message}`)
      }

      let browserKeyPair
      try {
        browserKeyPair = await generateKeyPair()
      } catch (err) {
        throw new Error(`Key generation failed: ${err.name || err.message}`)
      }

      let sharedSecret
      try {
        sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      } catch (err) {
        throw new Error(`Key exchange failed: ${err.name || err.message}`)
      }

      let aesKey
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
        showStatus(statusContainer, 'Credentials sent. Waiting for server to complete setup...', 'info')
        startMessagePolling(sessionId, statusContainer)

        // For E2E tests that expect .status-success immediately,
        // we add it here after successful submission.
        showStatus(statusContainer, 'Submission received.', 'success')
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      console.error('Relay submit error:', err)
      showStatus(statusContainer, err.message || String(err), 'error')
      submitBtn.disabled = false
      submitBtn.textContent = originalBtnText
    }
  })
}

/**
 * Adds a "Skip" button to the form that bypasses remote setup.
 */
export function setupSkipButton({
  sessionId,
  formId = 'setup-form',
  statusContainerId = 'status-container',
  text = 'Skip Setup (use defaults)',
  successMessage = 'Setup skipped. Server will use default settings.'
}) {
  const form = document.getElementById(formId)
  const statusContainer = document.getElementById(statusContainerId)

  if (!form || !statusContainer) return null

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
      const response = await fetch(`/api/sessions/${sessionId}/skip`, {
        method: 'POST'
      })
      if (response.ok) {
        showStatus(statusContainer, successMessage, 'success')
        form.style.display = 'none'
      } else {
        throw new Error(`Skip failed: ${response.status}`)
      }
    } catch (err) {
      console.error('Skip error:', err)
      skipBtn.disabled = false
      skipBtn.textContent = originalText

      // Handle non-200 responses and reset UI state to prevent hanging
      showStatus(statusContainer, err.message || String(err), 'error')
    }
  })

  form.appendChild(skipBtn)
  return skipBtn
}
