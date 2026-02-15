---
title: 'Adding a contact form without a form service'
date: 2026-02-15
tags: ['website', 'infrastructure']
draft: false
---

The marketing site had zero forms and zero client-side JavaScript. We wanted to add a contact form without changing either of those properties more than necessary. No Typeform, no Formspree, no external dependencies - just a Cloudflare Pages Function that calls the Resend API.

## What We Did

The form lives at `/contact` and submits to a Pages Function at `/api/contact`. Cloudflare auto-discovers the `functions/` directory alongside the static `dist/` output and deploys them together. The function handles both JSON and form-encoded bodies for progressive enhancement - without JavaScript, the form POSTs and redirects back with a query parameter (`?sent=1` or `?error=server`). With JavaScript, a `<script>` intercepts the submit, does a fetch, and shows inline feedback via an `aria-live` region.

The function validates inputs (name, email, message), rejects control characters to prevent header injection, checks the `Origin` header against the production domain, and includes a honeypot field. Bots that fill the hidden `website` field get a silent 200 response with no email sent.

Emails send through Resend's API. We verified our domain as a sending domain with DKIM and SPF records on Cloudflare DNS, so emails come from a branded address rather than the generic `onboarding@resend.dev` sandbox address. The API key lives in Infisical as the single source of truth and is deployed as an encrypted environment variable to each Cloudflare service that needs email.

The CI pipeline needed a one-line change: the deploy job previously only downloaded the `dist/` build artifact, but `functions/` is source code that lives in the repo. Adding a checkout step to the deploy job puts both directories in the working tree for Wrangler to pick up.

Rate limiting uses a Cloudflare security rule - 5 requests per 10 seconds per IP on `/api/contact`, configured through the dashboard. No code needed.

The site's existing `Content-Security-Policy` header required no changes. Astro bundles `<script>` tags into external files under `dist/_astro/`, which satisfies the existing `script-src 'self'` directive. The `form-action 'self'` directive already permits same-origin POST. The `connect-src 'self'` directive covers the fetch call.

## What Surprised Us

Resend's suppression list nearly derailed the production test. The API accepted the email (returned `{"ok": true}`), but checking the delivery status through the API revealed `"last_event": "suppressed"`. The recipient address had bounced during an earlier test before mail hosting was fully configured, and Resend silently added it to a suppression list. Future sends to that address returned success to the caller but never actually delivered. The fix was manual - remove the address from the suppression list through Resend's dashboard. Without checking the delivery status via the API, we would have shipped a form that appeared to work but silently dropped every submission.
