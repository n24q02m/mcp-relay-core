import { encryptAndSubmit, getSetupParams } from '/shared/relay-client.js'
import { renderFields, setupSkipButton, showStatus, startMessagePolling } from '/shared/ui.js'

const params = getSetupParams()

if (!params) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
  const { sessionId } = params
  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  const schema = session.schema || {}
  const fields = schema.fields || []

  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

  renderFields(fieldsContainer, fields)
  submitBtn.disabled = false

  const form = document.getElementById('setup-form')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}
      for (const field of fields) {
        const input = document.getElementById(field.key)
        if (input?.value) config[field.key] = input.value
      }

      const result = await encryptAndSubmit(config, params)
      if (result.ok) {
        form.style.display = 'none'
        showStatus(
          document.getElementById('status-container'),
          'Credentials sent. Waiting for server to complete setup...',
          'success'
        )
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

  setupSkipButton(form, sessionId, {
    label: 'Skip (use local mode)',
    successMessage: 'Setup skipped. Using local ONNX models.'
  })
}
