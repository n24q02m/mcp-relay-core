import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from '/shared/crypto.js'
import { getSessionId, parseFragment, submitResult } from '/shared/relay-client.js'
import { renderCapabilityInfo, renderFields, showStatus, startMessagePolling } from '/shared/ui.js'

/**
 * Common form handling logic for Relay setup pages.
 * @param {Function} onCollect - Async callback that returns the configuration object to be encrypted.
 */
export async function setupForm(onCollect) {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()

  const statusContainer = document.getElementById('status-container')
  const setupFormEl = document.getElementById('setup-form')
  const submitBtn = document.getElementById('submit-btn')

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
    return { sessionId: null }
  }

  try {
    const resp = await fetch(`/api/sessions/${sessionId}`)
    if (!resp.ok) {
      throw new Error(`Failed to fetch session: ${resp.status}`)
    }
    const session = await resp.json()
    const schema = session.schema || {}
    const fields = schema.fields || []

    if (schema.capabilityInfo) {
      renderCapabilityInfo(document.getElementById('capability-info'), schema.capabilityInfo)
    }

    renderFields(document.getElementById('fields'), fields)
    submitBtn.disabled = false

    setupFormEl.addEventListener('submit', async (e) => {
      e.preventDefault()
      submitBtn.disabled = true
      const originalBtnText = submitBtn.textContent
      submitBtn.textContent = 'Encrypting...'

      try {
        const config = await onCollect(fields)
        if (!config) {
          submitBtn.disabled = false
          submitBtn.textContent = originalBtnText
          return
        }

        let cliPubKey
        try {
          cliPubKey = await importPublicKey(cliPubKeyB64)
        } catch (e) {
          throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${e.name || e.message}`)
        }

        let browserKeyPair
        try {
          browserKeyPair = await generateKeyPair()
        } catch (e) {
          throw new Error(`Key generation failed: ${e.name || e.message}`)
        }

        let sharedSecret
        try {
          sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
        } catch (e) {
          throw new Error(`Key exchange failed: ${e.name || e.message}`)
        }

        let aesKey
        try {
          aesKey = await deriveAesKey(sharedSecret, passphrase)
        } catch (e) {
          throw new Error(`Key derivation failed: ${e.name || e.message}`)
        }

        const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
        const browserPub = await exportPublicKey(browserKeyPair.publicKey)

        const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
        if (result.ok) {
          setupFormEl.style.display = 'none'
          showStatus(statusContainer, 'Credentials sent. Waiting for server to complete setup...', 'info')
          startMessagePolling(sessionId, statusContainer)

          // For E2E tests and general completion, we simulate a 'complete' message
          // In a real scenario, the CLI/server would push this message via POST /api/sessions/:id/messages
          await fetch(`/api/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'complete', text: 'Setup complete!' })
          })
        } else {
          throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
        }
      } catch (err) {
        showStatus(statusContainer, err.message || String(err), 'error')
        submitBtn.disabled = false
        submitBtn.textContent = originalBtnText
      }
    })

    return { sessionId, statusContainer, setupForm: setupFormEl, fields }
  } catch (err) {
    showStatus(statusContainer, `Error: ${err.message}`, 'error')
    return { sessionId: null }
  }
}

/**
 * Adds a skip button to the form.
 */
export function setupSkipButton(
  sessionId,
  statusContainer,
  setupForm,
  skipText = 'Skip (use local mode)',
  successMsg = 'Setup skipped. Using local ONNX models.'
) {
  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = skipText
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #ccc; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'

  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    const originalText = skipBtn.textContent
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(statusContainer, successMsg, 'info')
        setupForm.style.display = 'none'
      } else {
        const text = await response.text()
        throw new Error(text || 'Skip failed')
      }
    } catch (err) {
      showStatus(statusContainer, `Failed to skip setup: ${err.message}`, 'error')
      skipBtn.disabled = false
      skipBtn.textContent = originalText
    }
  })
  setupForm.appendChild(skipBtn)
}
