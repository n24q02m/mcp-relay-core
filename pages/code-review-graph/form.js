import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { renderCapabilityInfo, renderFields } from '/shared/ui.js'

const { sessionId } = await setupForm({
  onCollect: async () => {
    const config = {}
    for (const field of fields) {
      const input = document.getElementById(field.key)
      if (input?.value) config[field.key] = input.value
    }
    return config
  }
})

let fields = []
if (sessionId) {
  const resp = await fetch(`/api/sessions/${sessionId}`)
  const session = await resp.json()
  const schema = session.schema || {}
  fields = schema.fields || []

  if (schema.capabilityInfo) {
    renderCapabilityInfo(document.getElementById('capability-info'), schema.capabilityInfo)
  }

  renderFields(document.getElementById('fields'), fields)
  document.getElementById('submit-btn').disabled = false

  setupSkipButton(sessionId)
}
