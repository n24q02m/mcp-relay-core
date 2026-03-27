import { parseFragment, getSessionId, submitResult } from '/shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '/shared/crypto.js'
import { renderFields, showStatus } from '/shared/ui.js'

const fields = [
  {
    key: 'GEMINI_API_KEY',
    label: 'Gemini API Key',
    type: 'password',
    placeholder: 'AIza...',
    helpUrl: 'https://aistudio.google.com/apikey',
    helpText: 'Get your API key from Google AI Studio',
  },
]

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
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

      const cliPubKey = await importPublicKey(cliPubKeyB64)
      const browserKeyPair = await generateKeyPair()
      const sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      const aesKey = await deriveAesKey(sharedSecret, passphrase)

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const ok = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (ok) {
        showStatus(
          document.getElementById('status-container'),
          'Setup complete! You can close this page.',
          'success'
        )
        document.getElementById('setup-form').style.display = 'none'
      } else {
        throw new Error('Failed to submit')
      }
    } catch (err) {
      showStatus(document.getElementById('status-container'), `Error: ${err.message}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = 'Skip Setup (use defaults)'
  skipBtn.style.cssText = 'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'
  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (response.ok) {
        showStatus(document.getElementById('status-container'), 'Setup skipped. Server will use default settings.', 'info')
        document.getElementById('setup-form').style.display = 'none'
      }
    } catch (err) {
      skipBtn.disabled = false
      skipBtn.textContent = 'Skip Setup (use defaults)'
    }
  })
  document.getElementById('setup-form').appendChild(skipBtn)
}
