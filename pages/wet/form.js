import { parseFragment, getSessionId, submitResult } from '/shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '/shared/crypto.js'
import { renderFields, renderCapabilityInfo, showStatus, startMessagePolling } from '/shared/ui.js'

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
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

      let cliPubKey
      try { cliPubKey = await importPublicKey(cliPubKeyB64) }
      catch (e) { throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${e.name || e.message}`) }

      let browserKeyPair
      try { browserKeyPair = await generateKeyPair() }
      catch (e) { throw new Error(`Key generation failed: ${e.name || e.message}`) }

      let sharedSecret
      try { sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey) }
      catch (e) { throw new Error(`Key exchange failed: ${e.name || e.message}`) }

      let aesKey
      try { aesKey = await deriveAesKey(sharedSecret, passphrase) }
      catch (e) { throw new Error(`Key derivation failed: ${e.name || e.message}`) }

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (result.ok) {
        document.getElementById('setup-form').style.display = 'none'
        showStatus(
          document.getElementById('status-container'),
          'Credentials sent. Waiting for server to complete setup...',
          'info'
        )
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

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = 'Skip (use local mode)'
  skipBtn.style.cssText = 'background: transparent; color: #888; border: 1px solid #ccc; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'
  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(document.getElementById('status-container'), 'Setup skipped. Using local ONNX models.', 'info')
        document.getElementById('setup-form').style.display = 'none'
      }
    } catch (err) {
      skipBtn.disabled = false
      skipBtn.textContent = 'Skip (use local mode)'
    }
  })
  document.getElementById('setup-form').appendChild(skipBtn)
}
