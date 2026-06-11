---
title: 'Clerk SSR auth on the internal console, reusing the pattern we already proved'
date: 2026-06-02
tags: ['infrastructure', 'auth', 'cloudflare']
draft: false
shipped: 'Clerk SSR middleware on the internal console Worker'
---

_Retroactive log - reconstructed from commit history and session notes._

We shipped Clerk SSR auth on the internal console, replacing Cloudflare Access email-PIN with an in-domain sign-in flow backed by `@clerk/astro`.

The work came in three PRs. The first (#973) added a Cloudflare Pages Functions middleware using `@clerk/backend` directly - `authenticateRequest` handling all three Clerk request states (handshake, signed-in, signed-out), plus an app-level email allowlist enforced in the middleware itself using `CONSOLE_ALLOWED_EMAILS`. No Clerk Pro features required; the allowlist check runs at the middleware layer, not Clerk's dashboard Restrictions panel.

That approach hit a wall at first sign-up. Clerk's hosted sign-in redirect lived on a Clerk-hosted accounts subdomain, and the `redirect_url` parameter was dropped when navigating between hosted sign-in and sign-up. Fixing it required Account Portal home-URL config changes that are locked behind Clerk Pro for dev instances.

The second PR (#975) replaced the Pages Functions approach entirely with the pattern we already proved on one of our other products: `@clerk/astro` integration with app-hosted sign-in and sign-up pages at `/auth/sign-in` and `/auth/sign-up`. This also moved hosting from Cloudflare Pages to a Worker + Static Assets via `@astrojs/cloudflare` v13. The email allowlist logic mirrors the admin-auth middleware function from that other product, substituting an email-set check for its D1 role lookup. The migration was verified end-to-end on a Worker preview URL before merge: unauthenticated requests redirect to `/auth/sign-in?redirect_url=…`, and the sign-in page serves Clerk's JS with the publishable key inlined.

The third PR (#976) caught up docs and the deprecated-patterns scanner - disaster recovery doc, docs-sync pipeline diagram, and token registry updated to reflect the Worker URL and Clerk shape. New entries in `deprecated-patterns.json` for the console's old Pages deployment URL and `cloudflareaccess.com` so future docs that reach for the old setup get a build-time warning.

What surprised us: the first Clerk approach was architecturally sound but failed on a Clerk tier limitation we didn't discover until first browser test. The right pattern - app-hosted auth pages - was already in our codebase on another product. We should have read that implementation first rather than starting from the Clerk backend docs.

What's next: promote the Clerk instance from dev to production when we add a custom domain to the Worker.
