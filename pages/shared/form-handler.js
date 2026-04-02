import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from './crypto.js'
import { getSessionId, parseFragment, submitResult } from './relay-client.js'
import { renderCapabilityInfo, renderFields, showStatus, startMessagePolling } from './ui.js'

/**
 * Common encryption and submission logic for all setup forms.
 */
export async function encryptAndSubmit(config, { sessionId, cliPubKeyB64, passphrase }) {
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

  return await submitResult(sessionId, browserPub, ciphertext, iv, tag)
}

/**
 * Standard skip button logic.
 */
export function addSkipButton(sessionId, { label = 'Skip Setup (use defaults)', successMsg = 'Setup skipped.' } = {}) {
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
        showStatus(document.getElementById('status-container'), successMsg, 'info')
        document.getElementById('setup-form').style.display = 'none'
      }
    } catch (_err) {
      skipBtn.disabled = false
      skipBtn.textContent = label
    }
  })

  document.getElementById('setup-form').appendChild(skipBtn)
  return skipBtn
}

/**
 * High-level initializer for standard setup forms that fetch their schema from the server.
 */
export async function initSetupForm() {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(
      document.getElementById('status-container'),
      'Invalid setup URL. Please use the URL from your terminal.',
      'error'
    )
    return
  }

  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  const schema = session.schema || {}
  const fields = schema.fields || []

  const capInfoContainer = document.getElementById('capability-info')
  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

  if (schema.capabilityInfo) {
    renderCapabilityInfo(capInfoContainer, schema.capabilityInfo)
  }

  renderFields(fieldsContainer, fields)
  submitBtn.disabled = false

  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}
      for (const field of fields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }

      const result = await encryptAndSubmit(config, { sessionId, cliPubKeyB64, passphrase })

      if (result.ok) {
        document.getElementById('setup-form').style.display = 'none'
        // Use 'success' status as expected by e2e tests (and for better UX)
        showStatus(document.getElementById('status-container'), 'Credentials sent. Waiting for server...', 'success')
        startMessagePolling(sessionId, document.getElementById('status-container'))
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      showStatus(document.getElementById('status-container'), err.message || String(err), 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  addSkipButton(sessionId, {
    label: schema.skipLabel || 'Skip Setup (use defaults)',
    successMsg: schema.skipSuccessMsg || 'Setup skipped. Server will use default settings.'
  })
}
