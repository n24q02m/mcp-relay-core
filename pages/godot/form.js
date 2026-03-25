import { parseFragment, getSessionId, submitResult } from '../shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '../shared/crypto.js'
import { renderFields, showStatus } from '../shared/ui.js'

const fields = [
  {
    key: 'GODOT_PROJECT_PATH',
    label: 'Project Path',
    type: 'text',
    placeholder: '/path/to/project',
    helpText: 'Path to your Godot project directory',
  },
  {
    key: 'GODOT_PATH',
    label: 'Godot Executable Path',
    type: 'text',
    placeholder: '/usr/bin/godot4',
    required: false,
    helpText: 'Leave empty for auto-detection',
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
}
