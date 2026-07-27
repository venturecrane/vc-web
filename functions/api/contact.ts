/// <reference types="@cloudflare/workers-types" />

interface Env {
  RESEND_API_KEY: string
  TURNSTILE_SECRET_KEY: string
}

interface ContactPayload {
  name: string
  email: string
  message: string
  website?: string
  turnstileToken?: string
}

const ALLOWED_ORIGINS = ['https://venturecrane.com', 'https://www.venturecrane.com']

// Origin must be present and either same-origin (keeps *.pages.dev aliases and
// preview deploys working) or on the allowlist. Defense-in-depth only —
// trivially spoofable; Turnstile is the actual bot gate.
function isAllowedOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  return origin === new URL(requestUrl).origin
}

async function verifyTurnstile(secret: string, token: string, remoteIp?: string): Promise<boolean> {
  if (!secret) {
    // Distinct marker: misconfiguration, not a bot rejection. Visible in
    // `wrangler pages deployment tail`.
    console.error('TURNSTILE_MISCONFIG: TURNSTILE_SECRET_KEY is empty or unbound')
    return false
  }
  const form = new FormData()
  form.append('secret', secret)
  form.append('response', token)
  if (remoteIp) form.append('remoteip', remoteIp)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    })
    const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      // `timeout-or-duplicate` here = expired or reused token, not necessarily a bot
      console.error('Turnstile siteverify rejected:', JSON.stringify(data['error-codes'] ?? []))
    }
    return Boolean(data.success)
  } catch (err) {
    console.error('Turnstile siteverify unreachable:', err)
    return false
  }
}
const TO_EMAIL = 'smdurgan@venturecrane.com'
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

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function readPayload(
  request: Request,
  isJson: boolean
): Promise<ContactPayload | { error: 'parse' }> {
  try {
    const raw = await request.text()
    if (isJson) {
      return JSON.parse(raw) as ContactPayload
    }
    const parsed = parseFormData(raw)
    return {
      name: parsed.name || '',
      email: parsed.email || '',
      message: parsed.message || '',
      website: parsed.website || '',
      // Field name Turnstile injects into native form posts
      turnstileToken: parsed['cf-turnstile-response'] || '',
    }
  } catch {
    return { error: 'parse' }
  }
}

function validate(data: ContactPayload): Record<string, string> {
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

  return errors
}

async function sendEmail(env: Env, data: ContactPayload): Promise<void> {
  const name = data.name.trim()
  const email = data.email.trim()
  const message = data.message.trim()

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  const contentType = request.headers.get('Content-Type') || ''
  const isJson = contentType.includes('application/json')
  const isForm = contentType.includes('application/x-www-form-urlencoded')

  if (!isJson && !isForm) {
    return jsonResponse({ error: 'Unsupported content type' }, 415)
  }

  const origin = request.headers.get('Origin')
  if (!isAllowedOrigin(origin, request.url)) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=validation',
      { error: 'Forbidden' },
      403
    )
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
    return redirectOrJson(isForm, request, '/contact/?sent=1', { ok: true }, 200)
  }

  const errors = validate(parsed)
  if (Object.keys(errors).length > 0) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=validation',
      { error: 'Validation failed', fields: errors },
      400
    )
  }

  // Turnstile is the bot gate. Fail closed: no token or failed verification → 400.
  const token = (parsed.turnstileToken || '').trim()
  const remoteIp = request.headers.get('CF-Connecting-IP') ?? undefined
  if (!token || !(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, remoteIp))) {
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=verification',
      { error: 'verification' },
      400
    )
  }

  try {
    await sendEmail(env, parsed)
  } catch (err) {
    console.error('Failed to send email:', err)
    return redirectOrJson(
      isForm,
      request,
      '/contact/?error=server',
      { error: 'Failed to send message. Please email smdurgan@venturecrane.com directly.' },
      500
    )
  }

  return redirectOrJson(isForm, request, '/contact/?sent=1', { ok: true }, 200)
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
