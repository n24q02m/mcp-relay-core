import { parseFragment, getSessionId, submitResult } from '/shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '/shared/crypto.js'
import { renderModes, renderFields, showStatus, startMessagePolling } from '/shared/ui.js'

const schema = {
  modes: [
    {
      id: 'bot',
      label: 'Bot Mode',
      description: 'Use a Telegram Bot token',
      fields: [
        {
          key: 'TELEGRAM_BOT_TOKEN',
          label: 'Bot Token',
          type: 'password',
          placeholder: '123456:ABC-DEF...',
          helpUrl: 'https://core.telegram.org/bots#botfather',
          helpText: 'Get from @BotFather on Telegram',
        },
      ],
    },
    {
      id: 'user',
      label: 'User Mode',
      description: 'Full account access via MTProto',
      fields: [
        {
          key: 'TELEGRAM_PHONE',
          label: 'Phone Number',
          type: 'tel',
          placeholder: '+84...',
          helpText: 'API ID and API Hash are built-in. Only your phone number is needed.',
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
      // Collect form values
      const config = {}
      for (const field of currentFields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }

      // ECDH key exchange
      const cliPubKey = await importPublicKey(cliPubKeyB64)
      const browserKeyPair = await generateKeyPair()
      const sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      const aesKey = await deriveAesKey(sharedSecret, passphrase)

      // Encrypt
      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      // Submit
      const ok = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (ok) {
        document.getElementById('setup-form').style.display = 'none'
        showStatus(
          document.getElementById('status-container'),
          'Credentials sent. Waiting for server...',
          'info'
        )
        startMessagePolling(sessionId, document.getElementById('status-container'))
      } else {
        throw new Error('Failed to submit')
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown encryption error'
      console.error('Relay submit error:', err)
      showStatus(document.getElementById('status-container'), `Error: ${msg}`, 'error')
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
