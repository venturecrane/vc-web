/// <reference types="@cloudflare/workers-types" />

interface Env {
  RESEND_API_KEY: string
}

interface ContactPayload {
  name: string
  email: string
  message: string
  website?: string
}

const ALLOWED_ORIGINS = ['https://venturecrane.com', 'https://www.venturecrane.com']
const TO_EMAIL = 'scott@venturecrane.com'
const FROM_EMAIL = 'Venture Crane <contact@venturecrane.com>'
const CONTROL_CHAR_RE = /[\r\n\0]/

function hasControlChars(value: string): boolean {
  return CONTROL_CHAR_RE.test(value)
}

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
  // RFC 5322 simplified - must have exactly one @, non-empty local and domain
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  if (!local || !domain) return false
  if (domain.indexOf('.') === -1) return false
  return true
}

function parseFormData(body: string): Record<string, string> {
  const params = new URLSearchParams(body)
  const result: Record<string, string> = {}
  for (const [key, value] of params) {
    result[key] = value
  }
  return result
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  // Origin check
  const origin = request.headers.get('Origin')
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const contentType = request.headers.get('Content-Type') || ''
  const isJson = contentType.includes('application/json')
  const isForm = contentType.includes('application/x-www-form-urlencoded')

  if (!isJson && !isForm) {
    return new Response(JSON.stringify({ error: 'Unsupported content type' }), {
      status: 415,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let data: ContactPayload
  try {
    const raw = await request.text()
    if (isJson) {
      data = JSON.parse(raw) as ContactPayload
    } else {
      const parsed = parseFormData(raw)
      data = {
        name: parsed.name || '',
        email: parsed.email || '',
        message: parsed.message || '',
        website: parsed.website || '',
      }
    }
  } catch {
    return isForm
      ? Response.redirect(new URL('/contact/?error=validation', request.url).toString(), 303)
      : new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  // Honeypot - silently succeed if bot filled the hidden field
  if (data.website) {
    return isForm
      ? Response.redirect(new URL('/contact/?sent=1', request.url).toString(), 303)
      : new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  // Validation
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim().length === 0) {
    errors.name = 'Name is required'
  } else if (data.name.length > 200) {
    errors.name = 'Name must be 200 characters or fewer'
  } else if (hasControlChars(data.name)) {
    errors.name = 'Name contains invalid characters'
  }

  if (!data.email || data.email.trim().length === 0) {
    errors.email = 'Email is required'
  } else if (hasControlChars(data.email)) {
    errors.email = 'Email contains invalid characters'
  } else if (!isValidEmail(data.email.trim())) {
    errors.email = 'Please enter a valid email address'
  }

  if (!data.message || data.message.trim().length === 0) {
    errors.message = 'Message is required'
  } else if (data.message.length > 5000) {
    errors.message = 'Message must be 5,000 characters or fewer'
  } else if (hasControlChars(data.message.replace(/\n/g, ''))) {
    // Allow newlines in message body, but reject \r and \0
    errors.message = 'Message contains invalid characters'
  }

  if (Object.keys(errors).length > 0) {
    return isForm
      ? Response.redirect(new URL('/contact/?error=validation', request.url).toString(), 303)
      : new Response(JSON.stringify({ error: 'Validation failed', fields: errors }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  // Send email via Resend
  const name = data.name.trim()
  const email = data.email.trim()
  const message = data.message.trim()

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        reply_to: email,
        subject: `Contact form: ${name}`,
        html: `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p><hr><p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('Resend API error:', res.status, body)
      throw new Error(`Resend API returned ${res.status}`)
    }
  } catch (err) {
    console.error('Failed to send email:', err)
    return isForm
      ? Response.redirect(new URL('/contact/?error=server', request.url).toString(), 303)
      : new Response(
          JSON.stringify({
            error: 'Failed to send message. Please email scott@venturecrane.com directly.',
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
  }

  return isForm
    ? Response.redirect(new URL('/contact/?sent=1', request.url).toString(), 303)
    : new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
}

// Reject non-POST
export const onRequest: PagesFunction = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', Allow: 'POST' },
    })
  }
  // POST is handled by onRequestPost
  return new Response(null, { status: 404 })
}
