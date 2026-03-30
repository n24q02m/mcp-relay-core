// Render form fields from schema
export function renderFields(container, fields) {
  for (const field of fields) {
    const div = document.createElement('div')
    div.className = 'field'

    const label = document.createElement('label')
    label.textContent = field.label
    label.htmlFor = field.key
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
      help.textContent = field.helpText
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

  for (const mode of modes) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mode-btn'
    btn.dataset.modeId = mode.id
    const strong = document.createElement('strong')
    strong.textContent = mode.label
    const small = document.createElement('small')
    small.textContent = mode.description
    btn.append(strong, document.createElement('br'), small)
    btn.addEventListener('click', () => {
      container.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      onSelect(mode)
    })
    select.appendChild(btn)
  }

  container.appendChild(select)
}

// Render a server-pushed message in the messages container
export function renderMessage(container, message) {
  const div = document.createElement('div')
  div.className = `relay-message relay-message-${message.type}`
  div.style.cssText = 'padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #333;'

  if (message.type === 'oauth_device_code') {
    div.style.borderColor = '#2980b9'
    const title = document.createElement('strong')
    title.textContent = message.text
    div.appendChild(title)

    const oauthUrl = message.data?.url || message.data?.verification_uri
    if (oauthUrl) {
      const link = document.createElement('a')
      link.href = oauthUrl
      link.target = '_blank'
      link.textContent = oauthUrl
      link.style.cssText = 'display: block; margin: 8px 0; color: #3498db;'
      div.appendChild(link)
    }
    const oauthCode = message.data?.code || message.data?.user_code
    if (oauthCode) {
      const code = document.createElement('code')
      code.textContent = oauthCode
      code.style.cssText = 'display: block; font-size: 1.5em; padding: 12px; background: #f0f0f0; color: #1a1a2e; border-radius: 4px; text-align: center; letter-spacing: 3px; user-select: all; font-weight: bold;'
      div.appendChild(code)
    }
  } else if (message.type === 'info') {
    div.style.borderColor = '#555'
    const text = document.createElement('p')
    text.textContent = message.text
    text.style.margin = '0'
    div.appendChild(text)
  } else if (message.type === 'complete') {
    div.style.borderColor = '#27ae60'
    div.style.background = 'rgba(39, 174, 96, 0.1)'
    const text = document.createElement('p')
    text.textContent = message.text
    text.style.margin = '0'
    div.appendChild(text)
  } else if (message.type === 'error') {
    div.style.borderColor = '#c0392b'
    div.style.background = 'rgba(192, 57, 43, 0.1)'
    const text = document.createElement('p')
    text.textContent = message.text
    text.style.margin = '0'
    div.appendChild(text)
  }

  container.appendChild(div)
}

// Start polling for server messages after credential submit
export function startMessagePolling(sessionId, statusContainer) {
  const messagesContainer = document.createElement('div')
  messagesContainer.id = 'server-messages'
  document.body.appendChild(messagesContainer)

  let lastIndex = 0
  const pollMessages = async () => {
    try {
      const resp = await fetch(`/api/sessions/${sessionId}/messages?after=${lastIndex}`)
      if (!resp.ok) return // session expired
      const { messages } = await resp.json()
      for (const msg of messages) {
        if (msg.type === 'input_required') {
          const wrapper = document.createElement('div')
          wrapper.style.cssText = 'padding: 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #2980b9;'

          const label = document.createElement('label')
          label.textContent = msg.text
          label.htmlFor = `input-${msg.id}`
          label.style.display = 'block'
          label.style.margin = '0 0 8px 0'
          wrapper.appendChild(label)

          const input = document.createElement('input')
          input.id = `input-${msg.id}`
          input.type = msg.data?.input_type || 'text'
          input.placeholder = msg.data?.placeholder || 'Enter value...'
          input.style.cssText = 'width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #555; background: #1a1a2e; color: #eee; box-sizing: border-box;'
          wrapper.appendChild(input)

          const btn = document.createElement('button')
          btn.textContent = 'Submit'
          btn.style.cssText = 'background: #2980b9; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;'
          const submitResponse = async () => {
            if (!input.value) return
            btn.disabled = true
            btn.textContent = 'Sending...'
            input.disabled = true
            await fetch(`/api/sessions/${sessionId}/responses`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ messageId: msg.id, value: input.value })
            })
            // Collapse input, show waiting status
            input.style.display = 'none'
            btn.style.display = 'none'
            label.textContent = label.textContent + ' — submitted, waiting for server...'
            label.style.color = '#888'
          }
          btn.addEventListener('click', submitResponse)
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitResponse() })
          wrapper.appendChild(btn)
          setTimeout(() => input.focus(), 100)
          messagesContainer.appendChild(wrapper)
        } else {
          renderMessage(messagesContainer, msg)
        }

        lastIndex++

        if (msg.type === 'complete') {
          showStatus(statusContainer, msg.text || 'Setup complete!', 'success')
          return
        }
        if (msg.type === 'error') {
          showStatus(statusContainer, msg.text, 'error')
          return
        }
      }
    } catch (e) { /* ignore */ }
    setTimeout(pollMessages, 2000)
  }
  pollMessages()
}

// Show status message
export function showStatus(container, message, type = 'info') {
  const status = document.getElementById('status') || document.createElement('div')
  status.id = 'status'
  status.className = `status status-${type}`
  status.textContent = message
  container.appendChild(status)
}
