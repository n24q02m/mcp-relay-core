import { parseFragment, getSessionId, encryptAndSubmit } from './relay-client.js'
import { renderFields, renderCapabilityInfo, showStatus, startMessagePolling, renderSkipButton } from './ui.js'

/**
 * Standard initialization for dynamic form pages.
 * Fetches schema from the session, renders fields, and handles encryption & submission.
 */
export async function initForm({
  onConfig = (fields) => {
    const config = {}
    for (const field of fields) {
      const input = document.getElementById(field.key)
      if (input?.value) config[field.key] = input.value
    }
    return config
  },
  skipText = 'Skip Setup (use defaults)',
  skipMessage = 'Setup skipped. Server will use default settings.',
} = {}) {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()

  const statusContainer = document.getElementById('status-container')
  const fieldsContainer = document.getElementById('fields')
  const capInfoContainer = document.getElementById('capability-info')
  const submitBtn = document.getElementById('submit-btn')
  const setupForm = document.getElementById('setup-form')

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
    return
  }

  try {
    const resp = await fetch(`/api/sessions/${sessionId}`)
    if (!resp.ok) throw new Error(`Failed to fetch session: ${resp.status}`)
    const session = await resp.json()
    const schema = session.schema || {}
    const fields = schema.fields || []

    if (schema.capabilityInfo && capInfoContainer) {
      renderCapabilityInfo(capInfoContainer, schema.capabilityInfo)
    }

    renderFields(fieldsContainer, fields)
    submitBtn.disabled = false

    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      submitBtn.disabled = true
      submitBtn.textContent = 'Encrypting...'

      try {
        const config = onConfig(fields)
        const result = await encryptAndSubmit(sessionId, cliPubKeyB64, passphrase, config)

        if (result.ok) {
          setupForm.style.display = 'none'
          showStatus(statusContainer, 'Credentials sent. Waiting for server...', 'success')
          startMessagePolling(sessionId, statusContainer)
        } else {
          throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
        }
      } catch (err) {
        showStatus(statusContainer, err.message || String(err), 'error')
        submitBtn.disabled = false
        submitBtn.textContent = 'Encrypt & Send'
      }
    })

    const skipBtn = renderSkipButton(setupForm, sessionId, () => {
      showStatus(statusContainer, skipMessage, 'info')
      setupForm.style.display = 'none'
    })
    if (skipText) skipBtn.textContent = skipText
  } catch (err) {
    showStatus(statusContainer, `Error: ${err.message}`, 'error')
  }
}
