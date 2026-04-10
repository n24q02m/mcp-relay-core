import { initForm } from '/shared/form.js'

initForm({
  onCollectConfig: async ({ fields }) => {
    const config = {}
    for (const field of fields) {
      const input = document.getElementById(field.key)
      if (input?.value) config[field.key] = input.value
    }
    if (Object.keys(config).length === 0) {
      throw new Error('Please fill in at least one API key')
    }
    return config
  },
  skipText: 'Skip Setup (use defaults)',
  skipSuccessMessage: 'Setup skipped. Server will use default settings.'
})
