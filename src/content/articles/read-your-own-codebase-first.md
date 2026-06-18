---
title: 'Read Your Own Codebase First'
date: 2026-06-15
description: 'Before opening vendor documentation for a known-library integration, check whether another part of your codebase has already solved it - prior implementations encode hard-won constraints that vendor docs omit.'
author: 'Venture Crane'
tags: ['infrastructure', 'auth', 'process', 'engineering-practice']
draft: false
---

The right pattern was already in our codebase. We started from the vendor docs anyway.

When we added Clerk SSR auth to an internal console, we went to the Clerk documentation first. The approach looked correct: a Pages Functions middleware using `@clerk/backend` directly, handling all three Clerk request states (handshake, signed-in, signed-out), with an email allowlist enforced at the middleware layer. No Clerk Pro features required - the allowlist ran as our own logic, not Clerk's dashboard Restrictions panel.

That approach failed at the first browser test. Clerk's hosted sign-in lives on a Clerk-hosted subdomain, and the `redirect_url` parameter gets dropped when navigating between hosted sign-in and sign-up. Fixing it requires Account Portal home-URL config changes locked behind Clerk Pro for dev instances. We had built something architecturally sound and practically broken in a way that wasn't visible until a real browser session.

The solution was already on disk. Another product in the codebase uses `@clerk/astro` with app-hosted auth pages at `/auth/sign-in` and `/auth/sign-up`. That approach sidesteps the hosted subdomain entirely. The redirect behavior is controlled by our own routes, not Clerk's Account Portal config. The email allowlist logic from that product's admin middleware translated directly - swap a D1 role lookup for an email-set check and the structure is identical.

We replaced the Pages Functions approach entirely, verified end-to-end on a preview URL before merge, and shipped. Starting from the existing implementation eliminated the constraint-discovery cycle that consumed the first attempt.

## What Vendor Docs Don't Capture

Vendor documentation describes the happy path - the flow that works when you're on the right tier, with the right account configuration, and have not yet encountered the edge cases that engineers encounter in real integration work.

Prior implementations in your own codebase describe the corrections. They encode the constraints discovered at first browser test, the tier limitations that don't appear in the setup guide, the parameter behaviors that only surface when two parts of an external system interact in production. That information is not in any changelog. It lives in the code someone wrote after discovering the problem.

The asymmetry matters because the cost of discovering these constraints is high. The first attempt required a full research, design, implementation, integration-test, and failure cycle before the constraint appeared. Starting from an existing implementation in the codebase skips that cycle.

## The Heuristic

Before opening vendor documentation for a known-library integration, run this check: does another part of the codebase already use this library?

If yes, read that implementation before reading the docs. Specifically:

- What auth flow does it implement? (Hosted pages vs. app-hosted vs. backend-only)
- What configuration does it depend on? (Environment variables, redirect URLs, tier requirements)
- What edge cases does the middleware or route handler guard against?
- Are there comments or commit messages that explain why a particular approach was chosen over an alternative?

The answers to these questions are exactly what the vendor docs won't tell you.

This is not a claim that vendor docs are bad. They are necessary and often excellent. The point is narrower: for any integration where you have a prior implementation in your codebase, that implementation has already been filtered through the reality of your specific environment, your tier, your deploy target, and your auth requirements. Starting from the docs resets that filtering.

## Making Prior Implementations Discoverable

The heuristic only works if prior implementations are findable. In a codebase with multiple products that share infrastructure patterns, discoverability requires deliberate structure.

Naming conventions help. If every product that uses Clerk auth puts its middleware in the same relative path - `src/middleware/auth.ts`, for example - a developer starting a new integration knows exactly where to look. If the implementation is called `auth-handler.js` in one product and `clerk-middleware.ts` in another and `index.ts` in a third, the search cost goes up and developers default to the docs.

A deprecated-patterns tracker helps more. After completing the migration, we updated our `deprecated-patterns.json` to flag the old Pages deployment URL and the Cloudflare Access pattern we replaced. That file is checked at build time. A future implementation that reaches for the old setup gets a build-time warning pointing toward the proven approach. This is passive discovery - the pattern surfaces without requiring anyone to remember it exists.

Cross-product awareness requires the most active maintenance. When one product solves a hard integration problem, that solution needs to be visible to the people building the next product. Code review is one channel. Handoff notes that record which product solved a given integration problem are another. The goal is to lower the search cost enough that checking the codebase becomes faster than opening a browser tab.

## The Deeper Pattern

The broader principle here applies beyond auth libraries. Any time you are integrating a tool or library that your organization has used before, you have a choice: start from external documentation or start from internal implementation history.

External documentation is current but generic. Internal implementation history is potentially stale but specific. The right move depends on how much has changed in the library since your last integration and how specific your environment's requirements are.

For auth patterns in particular - where tier limitations, account configuration, and redirect behavior interact in non-obvious ways - implementation history wins. The constraints are stable, they are real, and they cost time to rediscover.

The target practice: when a developer starts an integration involving a library we've used before, the first artifact they read is the prior implementation, not the vendor setup guide. The docs become a supplement for the parts the prior implementation doesn't cover, not the starting point.

The heuristic generalizes: implementation history is a primary source, not a fallback.
