import { initForm } from '/shared/form.js'
import { renderFields, renderModes } from '/shared/ui.js'

const telegramSchema = {
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

let currentFields = []

initForm({
  schema: telegramSchema,
  onFieldsRendered: ({ schema, fieldsContainer, submitBtn }) => {
    const modesContainer = document.getElementById('modes')
    renderModes(modesContainer, schema.modes, (mode) => {
      fieldsContainer.innerHTML = ''
      currentFields = mode.fields
      renderFields(fieldsContainer, mode.fields)
      submitBtn.disabled = false
    })
  },
  collectConfig: () => {
    const config = {}
    for (const field of currentFields) {
      const input = document.getElementById(field.key)
      if (input?.value) config[field.key] = input.value
    }
    return config
  },
  skipLabel: 'Skip Setup (use defaults)'
})
