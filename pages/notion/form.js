import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { renderFields } from '/shared/ui.js'

const { sessionId } = await setupForm({
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

let fields = []
if (sessionId) {
  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  fields = session.schema?.fields || []

  renderFields(document.getElementById('fields'), fields)
  document.getElementById('submit-btn').disabled = false

  setupSkipButton(sessionId)
}
