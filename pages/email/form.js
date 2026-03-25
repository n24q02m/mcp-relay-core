import { parseFragment, getSessionId, submitResult } from '../shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '../shared/crypto.js'
import { renderFields, showStatus } from '../shared/ui.js'

const OAUTH_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com']
const APP_PASSWORD_DOMAINS = {
  'gmail.com': {
    label: 'App Password',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpText: 'Generate an App Password in your Google Account settings',
  },
  'googlemail.com': {
    label: 'App Password',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpText: 'Generate an App Password in your Google Account settings',
  },
  'yahoo.com': {
    label: 'App Password',
    helpText: 'Generate an App Password in Yahoo Account Security settings',
  },
  'icloud.com': {
    label: 'App Password',
    helpText: 'Generate an App Password at appleid.apple.com',
  },
}

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(
    document.getElementById('status-container'),
    'Invalid setup URL. Please use the URL from your terminal.',
    'error'
  )
} else {
  const fieldsContainer = document.getElementById('fields')
  const submitBtn = document.getElementById('submit-btn')
  let dynamicFields = []

  // Render email entry field
  const emailField = [
    {
      key: 'EMAIL_ADDRESS',
      label: 'Email Address',
      type: 'email',
      placeholder: 'you@example.com',
    },
  ]
  renderFields(fieldsContainer, emailField)

  const extraContainer = document.createElement('div')
  extraContainer.id = 'extra-fields'
  fieldsContainer.appendChild(extraContainer)

  const emailInput = document.getElementById('EMAIL_ADDRESS')
  emailInput.addEventListener('input', () => {
    const domain = emailInput.value.split('@')[1]?.toLowerCase()
    extraContainer.innerHTML = ''
    dynamicFields = []

    if (!domain) {
      submitBtn.disabled = true
      return
    }

    if (OAUTH_DOMAINS.includes(domain)) {
      const notice = document.createElement('div')
      notice.className = 'field'
      const msg = document.createElement('p')
      msg.textContent = 'Outlook requires OAuth2. This will be handled automatically by the server.'
      notice.appendChild(msg)
      extraContainer.appendChild(notice)
      dynamicFields = [{ key: 'AUTH_METHOD', value: 'oauth2' }]
      submitBtn.disabled = false
    } else if (APP_PASSWORD_DOMAINS[domain]) {
      const info = APP_PASSWORD_DOMAINS[domain]
      const fields = [
        {
          key: 'APP_PASSWORD',
          label: info.label,
          type: 'password',
          helpUrl: info.helpUrl,
          helpText: info.helpText,
        },
      ]
      renderFields(extraContainer, fields)
      dynamicFields = fields
      submitBtn.disabled = false
    } else {
      // Custom domain
      const fields = [
        {
          key: 'EMAIL_PASSWORD',
          label: 'Password',
          type: 'password',
        },
        {
          key: 'IMAP_HOST',
          label: 'IMAP Host',
          type: 'text',
          placeholder: 'imap.example.com',
          required: false,
          helpText: 'Optional. Leave empty for auto-detection.',
        },
      ]
      renderFields(extraContainer, fields)
      dynamicFields = fields
      submitBtn.disabled = false
    }
  })

  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const config = {}

      // Collect email address
      const emailVal = document.getElementById('EMAIL_ADDRESS')?.value
      if (emailVal) config.EMAIL_ADDRESS = emailVal

      // Collect dynamic fields
      for (const field of dynamicFields) {
        if (field.value) {
          // Hidden field (like AUTH_METHOD=oauth2)
          config[field.key] = field.value
        } else {
          const input = document.getElementById(field.key)
          if (input?.value) config[field.key] = input.value
        }
      }

      const cliPubKey = await importPublicKey(cliPubKeyB64)
      const browserKeyPair = await generateKeyPair()
      const sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey)
      const aesKey = await deriveAesKey(sharedSecret, passphrase)

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const ok = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (ok) {
        showStatus(
          document.getElementById('status-container'),
          'Setup complete! You can close this page.',
          'success'
        )
        document.getElementById('setup-form').style.display = 'none'
      } else {
        throw new Error('Failed to submit')
      }
    } catch (err) {
      showStatus(document.getElementById('status-container'), `Error: ${err.message}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })
}
