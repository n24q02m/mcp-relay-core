import { parseFragment, getSessionId, submitResult } from '../shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '../shared/crypto.js'
import { renderModes, renderFields, showStatus } from '../shared/ui.js'

const schema = {
  modes: [
    {
      id: 'local',
      label: 'Local (ONNX)',
      description: 'Uses built-in ONNX models. No setup needed.',
      fields: [],
    },
    {
      id: 'proxy',
      label: 'LiteLLM Proxy',
      description: 'Connect to a LiteLLM proxy server',
      fields: [
        {
          key: 'LITELLM_PROXY_URL',
          label: 'Proxy URL',
          type: 'url',
          placeholder: 'https://litellm.example.com',
        },
        {
          key: 'LITELLM_PROXY_KEY',
          label: 'Proxy Key',
          type: 'password',
          required: false,
          helpText: 'Optional authentication key',
        },
      ],
    },
    {
      id: 'sdk',
      label: 'SDK (API Keys)',
      description: 'Use provider API keys directly',
      fields: [
        {
          key: 'API_KEYS',
          label: 'API Keys',
          type: 'password',
          placeholder: 'GEMINI_API_KEY:AIza...',
          helpText: 'Format: PROVIDER_KEY:value',
        },
      ],
    },
  ],
}

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
  const modesContainer = document.getElementById('modes')
  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')
  let currentFields = []

  renderModes(modesContainer, schema.modes, (mode) => {
    fieldsContainer.innerHTML = ''
    currentFields = mode.fields
    renderFields(fieldsContainer, mode.fields)
    submitBtn.disabled = false
  })

  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}
      for (const field of currentFields) {
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
