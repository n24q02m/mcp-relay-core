import { encryptAndSubmit, getSetupParams } from '/shared/relay-client.js'
import { renderFields, renderModes, setupSkipButton, showStatus, startMessagePolling } from '/shared/ui.js'

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
          helpText: 'Get from @BotFather on Telegram'
        }
      ]
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
          helpText: 'API ID and API Hash are built-in. Only your phone number is needed.'
        }
      ]
    }
  ]
}

const params = getSetupParams()

if (!params) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
  const { sessionId } = params
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

  const form = document.getElementById('setup-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}
      for (const field of currentFields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }

      const result = await encryptAndSubmit(config, params)
      if (result.ok) {
        form.style.display = 'none'
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

  setupSkipButton(form, sessionId)
}
