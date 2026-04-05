import { setupForm, setupSkipButton } from '/shared/form-handler.js'

const {
  sessionId,
  statusContainer,
  setupForm: formEl
} = await setupForm(async (fields) => {
  const config = {}
  for (const field of fields) {
    const input = document.getElementById(field.key)
    if (input?.value) config[field.key] = input.value
  }
  return config
})

if (sessionId) {
  setupSkipButton(sessionId, statusContainer, formEl)
}
