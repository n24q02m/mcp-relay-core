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

  if (Object.keys(config).length === 0) {
    throw new Error('Please fill in at least one API key')
  }

  return config
})

if (sessionId) {
  setupSkipButton(
    sessionId,
    statusContainer,
    formEl,
    'Skip Setup (use defaults)',
    'Setup skipped. Server will use default settings.'
  )
}
