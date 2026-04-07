import { encryptAndSubmit, getSessionId, parseFragment, skipSession } from './relay-client.js'
import { renderCapabilityInfo, renderFields, showStatus, startMessagePolling } from './ui.js'

/**
 * Extracts and validates parameters from the URL.
 */
export function getParams() {
  const { publicKey, passphrase } = parseFragment()
  const sessionId = getSessionId()

  if (!publicKey || !passphrase || !sessionId) {
    showStatus(
      document.getElementById('status-container'),
      'Invalid setup URL. Please use the URL from your terminal.',
      'error'
    )
    return null
  }

  return { publicKey, passphrase, sessionId }
}

/**
 * Attaches a skip button to the form.
 */
export function handleSkip(
  params,
  {
    text = 'Skip Setup (use defaults)',
    successMessage = 'Setup skipped.',
    container = document.getElementById('setup-form')
  } = {}
) {
  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.textContent = text
  skipBtn.style.cssText =
    'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'

  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    const originalText = skipBtn.textContent
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await skipSession(params.sessionId)
      if (response.ok) {
        showStatus(document.getElementById('status-container'), successMessage, 'success')
        document.getElementById('setup-form').style.display = 'none'
      } else {
        throw new Error(`Skip failed: ${response.status}`)
      }
    } catch (_err) {
      skipBtn.disabled = false
      skipBtn.textContent = originalText
    }
  })

  container.appendChild(skipBtn)
  return skipBtn
}

/**
 * Handles the common form submission flow: encryption, status updates, and polling.
 */
export async function handleFormSubmit(
  e,
  params,
  configCollector,
  { submitBtn = document.getElementById('submit-btn'), successMessage = 'Credentials sent. Waiting for server...' } = {}
) {
  e.preventDefault()
  submitBtn.disabled = true
  const originalText = submitBtn.textContent
  submitBtn.textContent = 'Encrypting...'

  try {
    const config = await configCollector()
    const result = await encryptAndSubmit(params.sessionId, params.publicKey, params.passphrase, config)

    if (result.ok) {
      document.getElementById('setup-form').style.display = 'none'
      showStatus(document.getElementById('status-container'), successMessage, 'success')
      startMessagePolling(params.sessionId, document.getElementById('status-container'))
    } else {
      throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
    }
  } catch (err) {
    const msg = err?.message || err?.name || String(err) || 'Unknown error'
    console.error('Relay submit error:', err)
    showStatus(document.getElementById('status-container'), `Error: ${msg}`, 'error')
    submitBtn.disabled = false
    submitBtn.textContent = originalText
  }
}

/**
 * Bootstraps a form that fetches its schema from the relay server.
 */
export async function bootstrapForm(
  params,
  {
    onSchemaLoad = null,
    skipOptions = {},
    successMessage = 'Credentials sent. Waiting for server to complete setup...'
  } = {}
) {
  const resp = await fetch(`/api/sessions/${params.sessionId}`)
  if (!resp.ok) {
    showStatus(document.getElementById('status-container'), `Failed to load session: ${resp.status}`, 'error')
    return
  }

  const session = await resp.json()
  const schema = session.schema || {}
  const fields = schema.fields || []

  const capInfoContainer = document.getElementById('capability-info')
  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

  if (schema.capabilityInfo && capInfoContainer) {
    renderCapabilityInfo(capInfoContainer, schema.capabilityInfo)
  }

  if (fieldsContainer) {
    renderFields(fieldsContainer, fields)
  }

  if (submitBtn) {
    submitBtn.disabled = false
  }

  if (onSchemaLoad) {
    onSchemaLoad(schema)
  }

  document.getElementById('setup-form').addEventListener('submit', (e) => {
    handleFormSubmit(
      e,
      params,
      () => {
        const config = {}
        for (const field of fields) {
          const input = document.getElementById(field.key)
          if (input?.value) config[field.key] = input.value
        }
        return config
      },
      { submitBtn, successMessage }
    )
  })

  handleSkip(params, skipOptions)
}
