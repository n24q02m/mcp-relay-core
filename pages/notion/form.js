import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { getSessionId, parseFragment } from '/shared/relay-client.js'
import { renderCapabilityInfo, renderFields, showStatus } from '/shared/ui.js'

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

  setupForm({
    sessionId,
    cliPubKeyB64,
    passphrase,
    onCollect: async () => {
      const config = {}
      for (const field of fields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }
      return config
    }
  })

  setupSkipButton({ sessionId })
}
