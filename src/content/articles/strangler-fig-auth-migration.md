---
title: 'Collapsing Two Auth Systems Into One Without Rewriting 73 Call Sites'
date: 2026-05-21
description: 'A session shim that rebuilds the old session shape from a new identity provider lets you swap auth under dozens of call sites without a big-bang rewrite.'
author: 'Venture Crane'
tags: ['auth', 'architecture', 'migration', 'clerk']
draft: false
---

We were running two authentication systems in one application. One product, two ways to prove who you are.

The admin surface used a custom password system we had written ourselves: PBKDF2 hashing, a session table, a hand-rolled cookie. The client portal used Clerk, with magic-link invitations for onboarding new clients. The two had grown up separately, each reasonable in isolation, and now they sat side by side in the same codebase, each with its own sign-in page, its own session shape, its own logout path.

The admin surface had exactly one user.

That was the tell. We were maintaining a full custom auth stack, with all the security surface that implies, to serve a single account. Meanwhile Clerk was already in the codebase, already handling the harder multi-tenant case for the portal. The right move was obvious: collapse to a single Clerk-backed sign-in and delete the custom password code.

The obvious move was also the dangerous one. Across the admin surface, roughly 73 call sites read from `locals.session` - `userId`, `orgId`, `role`, `email`. Every admin page, every protected API route, every layout that rendered a logged-in chrome. A naive migration means touching all 73, swapping each `locals.session.userId` for whatever Clerk's user object exposes, and hoping you caught them all. That is a big-bang rewrite across the most security-sensitive code in the product. Get one wrong and you either lock the admin out or, worse, leak a route.

This is the article about how we avoided that. The pattern is a strangler fig: grow the new system inside the old one's contract until the old system can be cut away with nothing depending on it.

## The session shim

The core trick is a small adapter we called the admin session shim. It does one thing: synthesize the legacy session-data shape from a Clerk user id plus the local user row.

The legacy system populated `locals.session` with an object of a specific shape - `{ userId, orgId, role, email }`. Seventy-something call sites were written against that exact shape. They do not know or care where it came from; they know it is on `locals.session` and they read four fields off it.

So the shim reproduces that shape, sourced from Clerk instead of the password system. Given a Clerk user id, it looks up the corresponding local `users` row, confirms the role is `admin`, and assembles the same `{ userId, orgId, role, email }` object the old session minter used to produce. The middleware that runs on every request now populates `locals.session` from the shim rather than from the custom session cookie.

Because the output shape is byte-for-byte the old contract, all 73 call sites stay exactly as they were. Not one of them changed. They keep reading `locals.session.role` and `locals.session.email`; they have no idea the identity now comes from Clerk. The provider swapped underneath them and they never noticed.

A couple of details that mattered in practice:

- **Gate on role.** The shim only synthesizes a session for the admin role. A client signing in does not get an admin session materialized by accident. The role check is inside the adapter, not scattered across the call sites that trust its output.
- **Cache it.** Resolving Clerk user to local row on every request is a database round trip per request. We cached the synthesized session in Cloudflare KV with a short TTL (a couple of minutes). Short enough that a role change propagates quickly, long enough that a burst of requests does not hammer the database.

The shim is maybe a hundred lines. It is the whole reason the migration was not a rewrite. The expensive part of swapping an identity provider is not the provider integration; it is every place downstream that reads identity. An adapter that preserves the old read contract makes the downstream count irrelevant.

## Routing the two roles apart

With one sign-in handling both audiences, you need to send people to the right place after they authenticate. We added a post-sign-in role dispatcher: a single endpoint Clerk redirects to after authentication, which reads the role and routes admin to the admin surface and client to the client portal.

The old, role-specific sign-in URLs did not just disappear. The legacy admin and portal sign-in paths now issue a 301 redirect to the unified sign-in. Old bookmarks, old links in emails, anything pointing at the previous URLs lands on the new flow instead of a 404. The admin sign-out, which used to post to a custom logout endpoint, was swapped to Clerk's own sign-out component so that ending a session is Clerk's responsibility too, not a second code path we maintain.

## Backwards compatibility done right

Here is the part that separates a clean migration from an outage.

The client portal onboards new clients with magic-link invitation emails. When you flip the admin to Clerk, there are invitation emails already sitting in inboxes, already sent, carrying the old session-token format. If the cutover invalidates those tokens, every in-flight invitation breaks the moment you deploy. The client who got an email yesterday clicks it today and it is dead.

So we did not do a hard cutover. The middleware continues to accept and validate the legacy session-token cookie on portal paths, as a fallback, alongside the new Clerk-first path. A client arriving with an old magic-link token is still recognized. The tokens expire on their own schedule; we let the old path drain naturally rather than ripping it out under live traffic.

This is the strangler fig discipline applied to the wire format, not just the code. The new system is primary. The old system is a fallback that handles in-flight state and then ages out. Nobody experiences a cutover.

## Sequencing it as three PRs

We deliberately split the work so that the irreversible step came last.

**First, the shared visual lockup.** The two surfaces had drifted apart visually. Before touching auth, we unified the logo lockup so that when the sign-in pages merged, they already looked like one product. Pure presentation, no behavior, easy to verify, no risk. It cleared the decks.

**Second, the Clerk cutover with the shim.** This is the PR that introduced the session shim, the role dispatcher, the 301 redirects, and the legacy-token fallback. Critically, this PR added the new path and the compatibility fallback but deleted nothing. After it shipped, both the new Clerk flow and the old code coexisted. If something went wrong, the old behavior was still present underneath.

**Third, decommission the dead password code, after production verification.** Only once the Clerk flow was confirmed working in production did we delete the legacy admin sign-in form, the PBKDF2 hash-and-verify module, the custom session minter, and the orphaned re-exports and helpers they left behind. We deleted the dead admin password path. We did not delete the magic-link infrastructure, because the client portal invitation flow still depends on it - that is a separate migration for another day.

The ordering is the point. The decommission PR was drafted and ready while the cutover was still being verified, but it stayed gated. You do not remove the safety net to prove you do not need it. You remove it after you have proven you do not need it.

## Two bugs the pattern surfaced honestly

A migration like this turns up the latent assumptions in your data. Ours had pre-existing user rows from the old world that had never been bound to a Clerk identity - legacy invites and admin-side seeds with a null Clerk id. On first sign-in, those users could not auto-bind, because the uniqueness constraint blocked the just-in-time create path and the dispatcher's lookup keyed only on Clerk id. The result was a user stuck in a no-subscription loop with no way to sign out and try again.

The fix was an email-match fallback: when a signing-in Clerk identity has no bound row but there is an existing row with a matching email and a null Clerk id, link them - update the existing row to bind the Clerk identity, preserving its role and entity association. It only ever links unbound rows; it never overwrites an existing binding. We also gave the stuck-user page an actual sign-out button so a wedged session could recover itself.

A second follow-up fixed portal entity resolution for single-user clients that had a direct entity binding rather than a Clerk organization, and a sign-out button that was missing the prop that wires a custom button into Clerk's click handler. Small bugs, but the kind you only find by running the real flow against real production rows. We mention them because the honest version of "we migrated auth cleanly" includes the two follow-up fixes it took to actually be clean.

## The transferable lesson

When you unify two authentication systems, the cost is not the new provider. The cost is every call site downstream that reads identity, every email in flight carrying the old token, every assumption baked into your existing user rows.

An adapter that preserves the old session contract collapses the first cost to near zero. Write a shim that produces the exact shape your existing code already reads, source it from the new provider, and the dozens of call sites that trust that shape never have to change. Keep the old wire format valid as a draining fallback and the in-flight state migrates itself. Sequence the irreversible deletion last, after production has confirmed the new path, and a migration that looked like a big-bang rewrite of your most sensitive code becomes three small, individually verifiable steps.

The strangler fig does not demolish the old structure. It grows around it until the old structure carries no load, and only then do you cut it away.
