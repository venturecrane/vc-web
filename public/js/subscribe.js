document.querySelectorAll('.subscribe-form').forEach(function (form) {
  form.addEventListener('submit', async function (e) {
    e.preventDefault()
    const status = form.nextElementSibling
    const button = form.querySelector('button[type="submit"]')
    const emailInput = form.querySelector('input[type="email"]')

    button.disabled = true
    button.textContent = 'Subscribing...'
    status.innerHTML = ''

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value,
          website: form.querySelector('input[name="website"]').value,
        }),
      })

      if (res.ok) {
        status.innerHTML =
          '<p class="text-sm text-accent">Subscribed. You\'ll hear from us when we publish.</p>'
        emailInput.value = ''
        button.textContent = 'Subscribed'
      } else {
        const body = await res.json()
        status.innerHTML =
          '<p class="text-sm text-red-400">' + (body.error || 'Something went wrong.') + '</p>'
        button.textContent = 'Subscribe'
        button.disabled = false
      }
    } catch {
      status.innerHTML =
        '<p class="text-sm text-red-400">Something went wrong. Please try again.</p>'
      button.textContent = 'Subscribe'
      button.disabled = false
    }
  })
})
