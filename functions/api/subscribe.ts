/// <reference types="@cloudflare/workers-types" />

interface Env {
  BUTTONDOWN_API_KEY: string
}

interface SubscribePayload {
  email: string
  website?: string
}

const ALLOWED_ORIGINS = ['https://venturecrane.com', 'https://www.venturecrane.com']
const CONTROL_CHAR_RE = /[\r\n\0]/

function isValidEmail(email: string): boolean {
  if (email.length > 254) return false
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

  let data: SubscribePayload
  try {
    const raw = await request.text()
    if (isJson) {
      data = JSON.parse(raw) as SubscribePayload
    } else {
      const parsed = parseFormData(raw)
      data = {
        email: parsed.email || '',
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
      ? Response.redirect(new URL('/contact/?subscribed=1', request.url).toString(), 303)
      : new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  // Validation
  const email = (data.email || '').trim()

  if (!email) {
    return isForm
      ? Response.redirect(new URL('/contact/?error=validation', request.url).toString(), 303)
      : new Response(JSON.stringify({ error: 'Email is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  if (CONTROL_CHAR_RE.test(email) || !isValidEmail(email)) {
    return isForm
      ? Response.redirect(new URL('/contact/?error=validation', request.url).toString(), 303)
      : new Response(JSON.stringify({ error: 'Please enter a valid email address' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  // Subscribe via Buttondown API
  try {
    const res = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        type: 'regular',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      // 409 = already subscribed - treat as success
      if (res.status === 409) {
        return isForm
          ? Response.redirect(new URL('/contact/?subscribed=1', request.url).toString(), 303)
          : new Response(JSON.stringify({ ok: true }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            })
      }
      console.error('Buttondown API error:', res.status, body)
      throw new Error(`Buttondown API returned ${res.status}`)
    }
  } catch (err) {
    console.error('Failed to subscribe:', err)
    return isForm
      ? Response.redirect(new URL('/contact/?error=server', request.url).toString(), 303)
      : new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
  }

  return isForm
    ? Response.redirect(new URL('/contact/?subscribed=1', request.url).toString(), 303)
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
  return new Response(null, { status: 404 })
}
