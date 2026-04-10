import { encryptAndSubmit, getSessionId, parseFragment } from '/shared/relay-client.js'
import { renderCapabilityInfo, renderFields, renderSkipButton, showStatus, startMessagePolling } from '/shared/ui.js'

/**
 * Common form initialization logic.
 */
export async function initForm({ schema: providedSchema, collectConfig, onSuccess, skipLabel, onFieldsRendered } = {}) {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()

  const statusContainer = document.getElementById('status-container')
  const fieldsContainer = document.getElementById('fields')
  const capInfoContainer = document.getElementById('capability-info')
  const submitBtn = document.getElementById('submit-btn')
  const setupForm = document.getElementById('setup-form')

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
    return
  }

  try {
    let schema = providedSchema
    if (!schema) {
      const resp = await fetch(`/api/sessions/${sessionId}`)
      if (!resp.ok) throw new Error(`Failed to fetch session: ${resp.status}`)
      const session = await resp.json()
      schema = session.schema || {}
    }

    const fields = schema.fields || []

    if (schema.capabilityInfo && capInfoContainer) {
      renderCapabilityInfo(capInfoContainer, schema.capabilityInfo)
    }

    if (onFieldsRendered) {
      onFieldsRendered({ schema, fields, fieldsContainer, submitBtn })
    } else if (fieldsContainer) {
      renderFields(fieldsContainer, fields)
      if (submitBtn) submitBtn.disabled = false
    }

    setupForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (submitBtn) {
        submitBtn.disabled = true
        submitBtn.textContent = 'Encrypting...'
      }

      try {
        let config
        if (collectConfig) {
          config = await collectConfig({ fields, fieldsContainer })
        } else {
          config = {}
          for (const field of fields) {
            const input = document.getElementById(field.key)
            if (input?.value) config[field.key] = input.value
          }
        }

        await encryptAndSubmit(sessionId, cliPubKeyB64, passphrase, config)

        setupForm.style.display = 'none'
        const successMsg = 'Credentials sent. Waiting for server to complete setup...'
        showStatus(statusContainer, successMsg, 'info')

        if (onSuccess) {
          await onSuccess({ sessionId, statusContainer })
        } else {
          startMessagePolling(sessionId, statusContainer)
        }
      } catch (err) {
        showStatus(statusContainer, err.message || String(err), 'error')
        if (submitBtn) {
          submitBtn.disabled = false
          submitBtn.textContent = 'Encrypt & Send'
        }
      }
    })

    renderSkipButton(setupForm, sessionId, {
      label: skipLabel,
      onSkip: () => {
        showStatus(statusContainer, 'Setup skipped.', 'info')
        setupForm.style.display = 'none'
      }
    })
  } catch (err) {
    showStatus(statusContainer, `Initialization failed: ${err.message}`, 'error')
  }
}
