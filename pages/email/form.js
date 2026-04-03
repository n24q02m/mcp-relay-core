import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { getSessionId, parseFragment } from '/shared/relay-client.js'
import { renderFields, showStatus } from '/shared/ui.js'

const OAUTH_DOMAINS = ['outlook.com', 'hotmail.com', 'live.com']
const APP_PASSWORD_DOMAINS = {
  'gmail.com': {
    label: 'App Password',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpText: 'Generate an App Password in your Google Account settings'
  },
  'googlemail.com': {
    label: 'App Password',
    helpUrl: 'https://myaccount.google.com/apppasswords',
    helpText: 'Generate an App Password in your Google Account settings'
  },
  'yahoo.com': {
    label: 'App Password',
    helpText: 'Generate an App Password in Yahoo Account Security settings'
  },
  'icloud.com': {
    label: 'App Password',
    helpText: 'Generate an App Password at appleid.apple.com'
  }
}

const { publicKey: cliPubKeyB64, passphrase } = parseFragment()
const sessionId = getSessionId()

const statusContainer = document.getElementById('status-container')

if (!cliPubKeyB64 || !passphrase || !sessionId) {
  showStatus(statusContainer, 'Invalid setup URL. Please use the URL from your terminal.', 'error')
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
        placeholder: 'you@example.com'
      }
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
            helpText: info.helpText
          }
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
            helpText: 'Optional. Leave empty for auto-detection.'
          }
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

  setupForm({
    sessionId,
    cliPubKeyB64,
    passphrase,
    onCollect: async () => {
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

      return { EMAIL_CREDENTIALS: parts.join(',') }
    }
  })

  setupSkipButton({ sessionId })
}
