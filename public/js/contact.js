const form = document.getElementById('contact-form')
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const status = document.getElementById('form-status')
    const button = form.querySelector('button[type="submit"]')

    button.disabled = true
    button.textContent = 'Sending...'
    status.innerHTML = ''

    const data = {
      name: form.elements.namedItem('name').value,
      email: form.elements.namedItem('email').value,
      message: form.elements.namedItem('message').value,
      website: form.elements.namedItem('website').value,
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        status.innerHTML =
          '<div class="mb-6 rounded border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">Message sent. I\'ll get back to you soon.</div>'
        form.reset()
        form.style.display = 'none'
      } else {
        const body = await res.json()
        if (res.status === 400 && body.fields) {
          const msgs = Object.values(body.fields).join('. ')
          status.innerHTML = `<div class="mb-6 rounded border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">${msgs}</div>`
        } else {
          throw new Error(body.error || 'Request failed')
        }
      }
    } catch {
      status.innerHTML =
        '<div class="mb-6 rounded border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-400">Something went wrong. Please email <a href="mailto:smdurgan@venturecrane.com" class="underline">smdurgan@venturecrane.com</a> directly.</div>'
    } finally {
      button.disabled = false
      button.textContent = 'Send Message'
    }
  })
}
