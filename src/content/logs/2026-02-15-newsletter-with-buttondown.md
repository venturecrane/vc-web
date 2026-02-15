---
title: 'Adding a newsletter with Buttondown'
date: 2026-02-15
tags: ['website', 'infrastructure']
draft: false
---

The site had a contact form but no way to maintain a relationship with readers after they left. We added an email subscribe flow using Buttondown as the provider, following the same architecture pattern as the contact form - a Cloudflare Pages Function that calls an external API, with progressive enhancement on the client.

## What We Did

We picked Buttondown: free under 1,000 subscribers, Markdown-native, and RSS-to-email automation that checks the feed every 30 minutes. New articles and build logs auto-send to subscribers without any manual step. The $9/month Basic plan unlocks custom sending domains, so emails come from `mail.venturecrane.com` rather than Buttondown's default address.

The subscribe endpoint lives at `functions/api/subscribe.ts` - the same Pages Function pattern as the contact form. It validates the email, checks a honeypot field, verifies the `Origin` header against production domains, and calls Buttondown's API at `POST https://api.buttondown.email/v1/subscribers`. A 409 response (already subscribed) gets treated as success rather than surfaced as an error. The API key lives in Infisical and deploys as an encrypted environment variable to Cloudflare Pages.

The `Subscribe` component ships in two variants: an inline version that sits at the bottom of every article and build log ("Get notified when we publish"), and a card variant with a brief pitch for standalone placements. Both use the same form markup, the same honeypot field, and the same `subscribe.js` enhancement script. Without JavaScript, the form POSTs and redirects. With JavaScript, a fetch call shows inline feedback - same progressive enhancement approach as the contact form.

The custom sending domain required NS record delegation. Buttondown provisions a subdomain (`mail.venturecrane.com`) with its own nameservers, and we added the NS records through the Cloudflare DNS API. Buttondown handles DKIM, SPF, and DMARC on the delegated zone.

## What Surprised Us

Two bugs surfaced during production testing, both caused by Buttondown's defaults rather than our code.

The first was a field name mismatch. Buttondown's API expects `email_address`, not `email`. Our function sent `{ email: "..." }` and Buttondown returned a 422, which our error handling surfaced as a generic 500 to the client. The fix was a one-field rename in the request body, but the symptom - a 500 with no useful error message - took longer to trace than it should have. We had to call Buttondown's API directly with curl to isolate which side was rejecting the payload.

The second was Buttondown's firewall. The default configuration ships with "Aggressive" mode and IP address auditing enabled. Since all API-submitted subscribers come through Cloudflare's IP range rather than individual browser IPs, the firewall flagged every single subscriber as suspicious and blocked them. The subscriber appeared in Buttondown's dashboard but was immediately quarantined. The fix was to disable IP address auditing in the firewall settings - legitimate for our architecture since the Pages Function is the only path to the API, and it already validates inputs before forwarding.
