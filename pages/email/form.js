import { parseFragment, getSessionId, submitResult } from '/shared/relay-client.js'
import {
  importPublicKey,
  generateKeyPair,
  deriveSharedSecret,
  deriveAesKey,
  encrypt,
  exportPublicKey,
} from '/shared/crypto.js'
import { renderFields, showStatus, startMessagePolling } from '/shared/ui.js'

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
  let accountIndex = 0

  function createAccountCard(idx) {
    const card = document.createElement('div')
    card.className = 'account-card'
    card.dataset.idx = idx
    card.style.cssText =
      'border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 12px; position: relative;'

    const header = document.createElement('div')
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;'
    const title = document.createElement('strong')
    title.textContent = `Account ${idx + 1}`
    header.appendChild(title)

    if (idx > 0) {
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.textContent = 'Remove'
      removeBtn.style.cssText =
        'background: #c0392b; color: white; border: none; border-radius: 4px; padding: 4px 12px; cursor: pointer; font-size: 13px;'
      removeBtn.addEventListener('click', () => {
        card.remove()
        updateAccountNumbers()
      })
      header.appendChild(removeBtn)
    }
    card.appendChild(header)

    const emailContainer = document.createElement('div')
    renderFields(emailContainer, [
      {
        key: `email_${idx}`,
        label: 'Email Address',
        type: 'email',
        placeholder: 'you@example.com',
      },
    ])
    card.appendChild(emailContainer)

    const extraContainer = document.createElement('div')
    extraContainer.id = `extra_${idx}`
    card.appendChild(extraContainer)

    const emailInput = emailContainer.querySelector('input[type="email"]')
    emailInput.addEventListener('input', () => {
      const domain = emailInput.value.split('@')[1]?.toLowerCase()
      extraContainer.innerHTML = ''

      if (!domain) return

      if (OAUTH_DOMAINS.includes(domain)) {
        const notice = document.createElement('div')
        notice.className = 'field'
        const msg = document.createElement('p')
        msg.textContent = 'Outlook requires OAuth2. This will be handled automatically by the server.'
        notice.appendChild(msg)
        extraContainer.appendChild(notice)
      } else if (APP_PASSWORD_DOMAINS[domain]) {
        const info = APP_PASSWORD_DOMAINS[domain]
        renderFields(extraContainer, [
          {
            key: `password_${idx}`,
            label: info.label,
            type: 'password',
            helpUrl: info.helpUrl,
            helpText: info.helpText,
          },
        ])
      } else {
        renderFields(extraContainer, [
          { key: `password_${idx}`, label: 'Password', type: 'password' },
          {
            key: `imap_${idx}`,
            label: 'IMAP Host',
            type: 'text',
            placeholder: 'imap.example.com',
            required: false,
            helpText: 'Optional. Leave empty for auto-detection.',
          },
        ])
      }
      submitBtn.disabled = false
    })

    return card
  }

  function updateAccountNumbers() {
    const cards = fieldsContainer.querySelectorAll('.account-card')
    cards.forEach((card, i) => {
      card.querySelector('strong').textContent = `Account ${i + 1}`
    })
  }

  function collectAccounts() {
    const cards = fieldsContainer.querySelectorAll('.account-card')
    const accounts = []
    for (const card of cards) {
      const idx = card.dataset.idx
      const emailInput = card.querySelector('input[type="email"]')
      const email = emailInput?.value?.trim()
      if (!email) continue

      const domain = email.split('@')[1]?.toLowerCase()
      if (OAUTH_DOMAINS.includes(domain)) {
        accounts.push({ email, auth: 'oauth2' })
      } else {
        const passInput = card.querySelector(`#password_${idx}`)
        const password = passInput?.value
        if (!password) continue
        const imapInput = card.querySelector(`#imap_${idx}`)
        const imapHost = imapInput?.value?.trim()
        accounts.push({ email, password, imapHost })
      }
    }
    return accounts
  }

  // Add first account
  fieldsContainer.appendChild(createAccountCard(accountIndex++))

  // Add Account button
  const addBtn = document.createElement('button')
  addBtn.type = 'button'
  addBtn.textContent = '+ Add Another Account'
  addBtn.style.cssText =
    'background: #2980b9; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; margin-bottom: 16px; width: 100%;'
  addBtn.addEventListener('click', () => {
    fieldsContainer.insertBefore(createAccountCard(accountIndex++), addBtn)
  })
  fieldsContainer.appendChild(addBtn)

  document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    submitBtn.disabled = true
    submitBtn.textContent = 'Encrypting...'

    try {
      const accounts = collectAccounts()
      if (accounts.length === 0) {
        throw new Error('Please add at least one email account')
      }

      // Format as EMAIL_CREDENTIALS: email1:pass1,email2:pass2:imap_host
      const parts = accounts.map((a) => {
        if (a.auth === 'oauth2') return a.email
        if (a.imapHost) return `${a.email}:${a.password}:${a.imapHost}`
        return `${a.email}:${a.password}`
      })

      const config = { EMAIL_CREDENTIALS: parts.join(',') }

      // Step-by-step crypto with diagnostics
      console.log('Key length (base64url):', cliPubKeyB64?.length, 'Passphrase:', passphrase ? 'SET' : 'EMPTY')
      let cliPubKey, browserKeyPair, sharedSecret, aesKey
      try { cliPubKey = await importPublicKey(cliPubKeyB64) } catch (e) {
        throw new Error(`Key import failed (len=${cliPubKeyB64?.length}): ${e.name || e.message}`)
      }
      try { browserKeyPair = await generateKeyPair() } catch (e) {
        throw new Error(`Key generation failed: ${e.name || e.message}`)
      }
      try { sharedSecret = await deriveSharedSecret(browserKeyPair.privateKey, cliPubKey) } catch (e) {
        throw new Error(`Key exchange failed: ${e.name || e.message}`)
      }
      try { aesKey = await deriveAesKey(sharedSecret, passphrase) } catch (e) {
        throw new Error(`Key derivation failed: ${e.name || e.message}`)
      }

      const { ciphertext, iv, tag } = await encrypt(aesKey, JSON.stringify(config))
      const browserPub = await exportPublicKey(browserKeyPair.publicKey)

      const result = await submitResult(sessionId, browserPub, ciphertext, iv, tag)
      if (result.ok) {
        document.getElementById('setup-form').style.display = 'none'
        showStatus(
          document.getElementById('status-container'),
          'Credentials sent. Waiting for server...',
          'info'
        )
        startMessagePolling(sessionId, document.getElementById('status-container'))
      } else {
        throw new Error(`Submit failed (${result.status}): ${result.error || 'unknown error'}`)
      }
    } catch (err) {
      const msg = err?.message || err?.name || String(err) || 'Unknown encryption error'
      console.error('Relay submit error:', err)
      showStatus(document.getElementById('status-container'), `Error: ${msg}`, 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Encrypt & Send'
    }
  })

  const skipBtn = document.createElement('button')
  skipBtn.type = 'button'
  skipBtn.id = 'skip-btn'
  skipBtn.textContent = 'Skip Setup (use defaults)'
  skipBtn.style.cssText = 'background: transparent; color: #888; border: 1px solid #555; border-radius: 4px; padding: 8px 16px; cursor: pointer; width: 100%; margin-top: 8px;'
  skipBtn.addEventListener('click', async () => {
    skipBtn.disabled = true
    skipBtn.textContent = 'Skipping...'
    try {
      const response = await fetch(`/api/sessions/${sessionId}/skip`, { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Skip failed (${response.status})`)
      }
      showStatus(document.getElementById('status-container'), 'Setup skipped. Server will use default settings.', 'info')
      document.getElementById('setup-form').style.display = 'none'
    } catch (err) {
      showStatus(document.getElementById('status-container'), err.message || String(err), 'error')
      skipBtn.disabled = false
      skipBtn.textContent = 'Skip Setup (use defaults)'
    }
  })
  document.getElementById('setup-form').appendChild(skipBtn)
}
