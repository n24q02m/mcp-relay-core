import { setupForm, setupSkipButton } from '/shared/form-handler.js'
import { getSessionId, parseFragment } from '/shared/relay-client.js'
import { showStatus } from '/shared/ui.js'

const OAUTH_DOMAINS = ['gmail.com', 'outlook.com', 'hotmail.com']

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
  const _submitBtn = document.getElementById('submit-btn')
  let accountIndex = 0

  function createAccountCard(idx) {
    const div = document.createElement('div')
    div.className = 'account-card'
    div.dataset.idx = idx
    div.style.cssText =
      'border: 1px solid #333; padding: 16px; margin-bottom: 16px; border-radius: 8px; background: #16213e;'

    const title = document.createElement('h3')
    title.textContent = `Account #${idx + 1}`
    title.style.margin = '0 0 12px 0'
    div.appendChild(title)

    const emailLabel = document.createElement('label')
    emailLabel.textContent = 'Email Address'
    emailLabel.htmlFor = `email_${idx}`
    div.appendChild(emailLabel)

    const emailInput = document.createElement('input')
    emailInput.id = `email_${idx}`
    emailInput.type = 'email'
    emailInput.placeholder = 'you@example.com'
    emailInput.required = true
    div.appendChild(emailInput)

    const authContainer = document.createElement('div')
    authContainer.style.marginTop = '12px'
    div.appendChild(authContainer)

    emailInput.addEventListener('input', () => {
      const email = emailInput.value.trim()
      const domain = email.split('@')[1]?.toLowerCase()
      authContainer.innerHTML = ''

      if (OAUTH_DOMAINS.includes(domain)) {
        const p = document.createElement('p')
        p.textContent = 'OAuth2 will be used for this domain. No password required here.'
        p.style.color = '#27ae60'
        authContainer.appendChild(p)
      } else if (domain) {
        const passLabel = document.createElement('label')
        passLabel.textContent = 'App Password'
        passLabel.htmlFor = `password_${idx}`
        authContainer.appendChild(passLabel)

        const passInput = document.createElement('input')
        passInput.id = `password_${idx}`
        passInput.type = 'password'
        passInput.required = true
        authContainer.appendChild(passInput)

        const imapLabel = document.createElement('label')
        imapLabel.textContent = 'IMAP Host (optional)'
        imapLabel.htmlFor = `imap_${idx}`
        imapLabel.style.marginTop = '8px'
        authContainer.appendChild(imapLabel)

        const imapInput = document.createElement('input')
        imapInput.id = `imap_${idx}`
        imapInput.placeholder = 'imap.example.com'
        authContainer.appendChild(imapInput)
      }
    })

    if (idx > 0) {
      const removeBtn = document.createElement('button')
      removeBtn.type = 'button'
      removeBtn.textContent = 'Remove'
      removeBtn.style.cssText =
        'background: #c0392b; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; margin-top: 12px;'
      removeBtn.addEventListener('click', () => div.remove())
      div.appendChild(removeBtn)
    }

    return div
  }

  function collectAccounts() {
    const cards = document.querySelectorAll('.account-card')
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
        alert('Please add at least one email account')
        return null
      }
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
