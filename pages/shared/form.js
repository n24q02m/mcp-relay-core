import { encryptAndSubmit, getSessionId, parseFragment } from '/shared/relay-client.js'
import { renderCapabilityInfo, renderFields, renderSkipButton, showStatus, startMessagePolling } from '/shared/ui.js'

/**
 * Shared form initialization logic
 * @param {Object} options
 * @param {Function} options.onCollectConfig - Custom function to collect form values
 * @param {Function} options.onRender - Custom function to render additional UI
 * @param {String} options.skipText - Custom text for skip button
 * @param {String} options.skipSuccessMessage - Custom success message for skip
 */
export async function initForm(options = {}) {
  const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
  const sessionId = getSessionId()
  const statusContainer = document.getElementById('status-container')
  const setupForm = document.getElementById('setup-form')
  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')

  if (!cliPubKeyB64 || !passphrase || !sessionId) {
    showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
    return
  }

  try {
    const resp = await fetch(`/api/sessions/${sessionId}`)
    if (!resp.ok) throw new Error(`Failed to fetch session: ${resp.status}`)
    const session = await resp.json()
    const schema = session.schema || {}
    let fields = schema.fields || []

    if (schema.capabilityInfo) {
      const capInfoContainer = document.getElementById('capability-info')
      if (capInfoContainer) renderCapabilityInfo(capInfoContainer, schema.capabilityInfo)
    }

    if (options.onRender) {
      await options.onRender({ session, schema, fields, fieldsContainer, submitBtn })
      // onRender might update fields
      if (session.schema?.fields) fields = session.schema.fields
    } else {
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
        let config = {}
        if (options.onCollectConfig) {
          config = await options.onCollectConfig({ fields })
        } else {
          for (const field of fields) {
            const input = document.getElementById(field.key)
            if (input?.value) config[field.key] = input.value
          }
        }

        const result = await encryptAndSubmit(sessionId, cliPubKeyB64, passphrase, config)
        if (result.ok) {
          setupForm.style.display = 'none'
          showStatus(statusContainer, 'Credentials sent. Waiting for server to complete setup...', 'info')
          startMessagePolling(sessionId, statusContainer)
        } else {
          throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
        }
      } catch (err) {
        showStatus(statusContainer, err.message || String(err), 'error')
        if (submitBtn) {
          submitBtn.disabled = false
          submitBtn.textContent = 'Encrypt & Send'
        }
      }
    })

    renderSkipButton(sessionId, setupForm, {
      text: options.skipText || 'Skip (use local mode)',
      successMessage: options.skipSuccessMessage || 'Setup skipped. Using local ONNX models.'
    })
  } catch (err) {
    showStatus(statusContainer, err.message || String(err), 'error')
  }
}
