import { initForm } from '/shared/form.js'

initForm({
  collectConfig: ({ fields }) => {
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
  skipLabel: 'Skip Setup (use defaults)'
})
