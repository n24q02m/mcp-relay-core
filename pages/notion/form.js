import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { getSessionId, parseFragment } from '/shared/relay-client.js'
import { renderFields, showStatus } from '/shared/ui.js'

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

const statusContainer = document.getElementById('status-container')

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
} else {
  // Fetch fields from session schema (server-defined, not hardcoded)
  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  const fields = session.schema?.fields || []

  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

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

      if (Object.keys(config).length === 0) {
        throw new Error('Please fill in at least one API key')
      }
      return config
    }
  })

  setupSkipButton({ sessionId })
}
