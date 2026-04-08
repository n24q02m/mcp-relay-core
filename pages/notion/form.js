import {
  deriveAesKey,
  deriveSharedSecret,
  encrypt,
  exportPublicKey,
  generateKeyPair,
  importPublicKey
} from '/shared/crypto.js'
import { getSessionId, parseFragment, submitResult } from '/shared/relay-client.js'
import { renderFields, showStatus, startMessagePolling } from '/shared/ui.js'

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
  // Fetch fields from session schema (server-defined, not hardcoded)
  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  const fields = session.schema?.fields || []

  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

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

      if (Object.keys(config).length === 0) {
        throw new Error('Please fill in at least one API key')
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
        document.getElementById('setup-form').style.display = 'none'
        showStatus(document.getElementById('status-container'), 'Credentials sent. Waiting for server...', 'success')
        startMessagePolling(sessionId, document.getElementById('status-container'))
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown encryption error'
      showStatus(document.getElementById('status-container'), `Error: ${msg}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = 'Skip Setup (use defaults)'
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'
  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(
          document.getElementById('status-container'),
          'Setup skipped. Server will use default settings.',
          'success'
        )
        document.getElementById('setup-form').style.display = 'none'
      }
    } catch (_err) {
      skipBtn.disabled = false
      skipBtn.textContent = 'Skip Setup (use defaults)'
    }
  })
  document.getElementById('setup-form').appendChild(skipBtn)
}
