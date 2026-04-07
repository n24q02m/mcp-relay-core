import { parseFragment, getSessionId, encryptAndSubmit } from '/shared/relay-client.js'
import { renderModes, renderFields, showStatus, startMessagePolling, renderSkipButton } from '/shared/ui.js'

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

const statusContainer = document.getElementById('status-container')
const setupForm = document.getElementById('setup-form')

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
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

  setupForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}
      for (const field of currentFields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }

      const result = await encryptAndSubmit(sessionId, cliPubKeyB64, passphrase, config)
      if (result.ok) {
        setupForm.style.display = 'none'
        showStatus(statusContainer, 'Credentials sent. Waiting for server...', 'success')
        startMessagePolling(sessionId, statusContainer)
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      showStatus(statusContainer, `Error: ${err.message || String(err)}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  renderSkipButton(setupForm, sessionId, () => {
    showStatus(statusContainer, 'Setup skipped. Server will use default settings.', 'info')
    setupForm.style.display = 'none'
  })
}
