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

export async function setupForm({
  sessionId,
  cliPubKeyB64,
  passphrase,
  formId = 'setup-form',
  submitBtnId = 'submit-btn',
  statusContainerId = 'status-container',
  onCollect // async callback returning the config object
}) {
  const form = document.getElementById(formId)
  const submitBtn = document.getElementById(submitBtnId)
  const statusContainer = document.getElementById(statusContainerId)

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

      // ECDH key exchange
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

      // Encrypt
      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      // Submit
      const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (result.ok) {
        form.style.display = 'none'
        showStatus(statusContainer, 'Credentials sent. Waiting for server...', 'info')
        // Added this line to show status success
        showStatus(statusContainer, 'Setup complete!', 'success')
        startMessagePolling(sessionId, statusContainer)
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown encryption error'
      console.error('Relay submit error:', err)
      showStatus(statusContainer, `Error: ${msg}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = originalBtnText
    }
  })
}

export function setupSkipButton({
  sessionId,
  formId = 'setup-form',
  statusContainerId = 'status-container',
  skipBtnText = 'Skip Setup (use defaults)',
  skipStatusMsg = 'Setup skipped. Server will use default settings.'
}) {
  const form = document.getElementById(formId)
  const statusContainer = document.getElementById(statusContainerId)

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = skipBtnText
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'

  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    const originalBtnText = skipBtn.textContent
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(statusContainer, skipStatusMsg, 'info')
        form.style.display = 'none'
      } else {
        throw new Error(`Skip failed (${response.status})`)
      }
    } catch (_err) {
      skipBtn.disabled = false
      skipBtn.textContent = originalBtnText
    }
  })
  form.appendChild(skipBtn)
}
