// Render form fields from schema
export function renderFields(container, fields) {
  for (const field of fields) {
    const div = document.createElement('div')
    div.className = 'field'

    const label = document.createElement('label')
    label.textContent = field.label
    label.htmlFor = field.key
    if (field.required !== false) {
      const ast = document.createElement('span')
      ast.setAttribute('aria-hidden', 'true')
      ast.textContent = ' *'
      label.appendChild(ast)
    }
    div.appendChild(label)

    const input = document.createElement('input')
    input.type = field.type === 'password' ? 'password' : field.type === 'select' ? 'text' : field.type
    input.id = field.key
    input.name = field.key
    input.placeholder = field.placeholder || ''
    input.required = field.required !== false
    div.appendChild(input)

    if (field.helpText) {
      const help = document.createElement('small')
      help.id = `${field.key}-help`
      help.textContent = field.helpText
      input.setAttribute('aria-describedby', help.id)
      div.appendChild(help)
    }
    if (field.helpUrl) {
      const link = document.createElement('a')
      link.href = field.helpUrl
      link.target = '_blank'
      link.textContent = 'How to get this?'
      link.className = 'help-link'
      div.appendChild(link)
    }

    container.appendChild(div)
  }
}

// Render mode selector
export function renderModes(container, modes, onSelect) {
  const select = document.createElement('div')
  select.className = 'mode-selector'
  select.setAttribute('role', 'group')
  select.setAttribute('aria-label', 'Select mode')

  for (const mode of modes) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mode-btn'
    btn.dataset.modeId = mode.id
    btn.setAttribute('aria-pressed', 'false')
    btn.innerHTML = `<strong>${mode.label}</strong><br><small>${mode.description}</small>`
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mode-btn').forEach((b) => {
        b.classList.remove('active')
        b.setAttribute('aria-pressed', 'false')
      })
      btn.classList.add('active')
      btn.setAttribute('aria-pressed', 'true')
      onSelect(mode)
    })
    select.appendChild(btn)
  }

  container.appendChild(select)
}

// Show status message
export function showStatus(container, message, type = 'info') {
  const status = document.getElementById('status') || document.createElement('div')
  status.id = 'status'
  status.className = `status status-${type}`
  status.textContent = message
  container.appendChild(status)
}
