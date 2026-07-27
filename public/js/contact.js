const form = document.getElementById('contact-form')

// Real sitekey on production domains; Cloudflare's always-pass test key
// everywhere else (localhost, *.pages.dev previews) so the form stays testable.
const PROD_HOSTS = ['venturecrane.com', 'www.venturecrane.com']
const SITEKEY = PROD_HOSTS.includes(location.hostname)
  ? '0x4AAAAAAD_PJ8XwYPzfcEz0'
  : '1x00000000000000000000AA'

let turnstileWidgetId = null

// Called by api.js (?onload=onTurnstileLoad) once the Turnstile script is ready
window.onTurnstileLoad = function () {
  const slot = document.getElementById('turnstile-slot')
  if (!slot || turnstileWidgetId !== null) return
  turnstileWidgetId = window.turnstile.render(slot, {
    sitekey: SITEKEY,
    theme: 'dark',
  })
}

function resetTurnstile() {
  if (window.turnstile && turnstileWidgetId !== null) {
    window.turnstile.reset(turnstileWidgetId)
  }
}

function showStatus(status, html) {
  status.innerHTML = html
}

const ERROR_BOX =
  'mb-6 rounded border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400'

async function submitContact(e, form) {
  e.preventDefault()
  const status = document.getElementById('form-status')
  const button = form.querySelector('button[type="submit"]')

  button.disabled = true
  button.textContent = 'Sending...'
  status.innerHTML = ''

  const token =
    window.turnstile && turnstileWidgetId !== null
      ? window.turnstile.getResponse(turnstileWidgetId)
      : ''

  const data = {
    name: form.elements.namedItem('name').value,
    email: form.elements.namedItem('email').value,
    message: form.elements.namedItem('message').value,
    website: form.elements.namedItem('website').value,
    turnstileToken: token,
  }

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      status.innerHTML =
        '<div class="mb-6 rounded border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">Message sent. We\'ll get back to you soon.</div>'
      form.reset()
      form.style.display = 'none'
    } else {
      const body = await res.json()
      if (res.status === 400 && body.error === 'verification') {
        // Token missing, failed, or expired (~5 min) while composing
        resetTurnstile()
        showStatus(
          status,
          `<div class="${ERROR_BOX}">Verification failed or expired — please resubmit, or email <a href="mailto:smdurgan@venturecrane.com" class="underline">smdurgan@venturecrane.com</a> directly.</div>`
        )
      } else if (res.status === 400 && body.fields) {
        const msgs = Object.values(body.fields).join('. ')
        resetTurnstile()
        showStatus(status, `<div class="${ERROR_BOX}">${msgs}</div>`)
      } else {
        throw new Error(body.error || 'Request failed')
      }
    }
  } catch {
    resetTurnstile()
    showStatus(
      status,
      `<div class="${ERROR_BOX}">Something went wrong. Please email <a href="mailto:smdurgan@venturecrane.com" class="underline">smdurgan@venturecrane.com</a> directly.</div>`
    )
  } finally {
    button.disabled = false
    button.textContent = 'Send Message'
  }
}

if (form) {
  form.addEventListener('submit', (e) => {
    void submitContact(e, form)
  })
}
