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

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function redirectOrJson(
  isForm: boolean,
  request: Request,
  formPath: string,
  jsonPayload: unknown,
  jsonStatus: number
): Response {
  if (isForm) {
    return Response.redirect(new URL(formPath, request.url).toString(), 303)
  }
  return jsonResponse(jsonPayload, jsonStatus)
}

async function readPayload(
  request: Request,
  isJson: boolean
): Promise<SubscribePayload | { error: 'parse' }> {
  try {
    const raw = await request.text()
    if (isJson) {
      return JSON.parse(raw) as SubscribePayload
    }
    const parsed = parseFormData(raw)
    return {
      email: parsed.email || '',
      website: parsed.website || '',
    }
  } catch {
    return { error: 'parse' }
  }
}

async function subscribeToButtondown(
  apiKey: string,
  email: string
): Promise<{ ok: true } | { ok: false; alreadySubscribed: boolean }> {
  const res = await fetch('https://api.buttondown.email/v1/subscribers', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      type: 'regular',
    }),
  })

  if (res.ok) return { ok: true }

  if (res.status === 409) {
    return { ok: false, alreadySubscribed: true }
  }

  const body = await res.text()
  console.error('Buttondown API error:', res.status, body)
  throw new Error(`Buttondown API returned ${res.status}`)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const origin = request.headers.get('Origin')
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }

  const contentType = request.headers.get('Content-Type') || ''
  const isJson = contentType.includes('application/json')
  const isForm = contentType.includes('application/x-www-form-urlencoded')

  if (!isJson && !isForm) {
    return jsonResponse({ error: 'Unsupported content type' }, 415)
  }

  const parsed = await readPayload(request, isJson)
  if ('error' in parsed) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=validation',
      { error: 'Invalid request body' },
      400
    )
  }

  // Honeypot - silently succeed if bot filled the hidden field
  if (parsed.website) {
    return redirectOrJson(isForm, request, '/contact/?subscribed=1', { ok: true }, 200)
  }

  const email = (parsed.email || '').trim()

  if (!email) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=validation',
      { error: 'Email is required' },
      400
    )
  }

  if (CONTROL_CHAR_RE.test(email) || !isValidEmail(email)) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=validation',
      { error: 'Please enter a valid email address' },
      400
    )
  }

  try {
    await subscribeToButtondown(env.BUTTONDOWN_API_KEY, email)
  } catch (err) {
    console.error('Failed to subscribe:', err)
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=server',
      { error: 'Something went wrong. Please try again.' },
      500
    )
  }

  return redirectOrJson(isForm, request, '/contact/?subscribed=1', { ok: true }, 200)
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
