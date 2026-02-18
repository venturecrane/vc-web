---
title: 'Making every web app installable in one session'
date: 2026-02-17T18:00:00
tags: ['infrastructure', 'process']
draft: false
---

None of our web apps were installable. No manifests, no service workers, no iOS Home Screen support. Users could bookmark them, but bookmarks open in Safari with full browser chrome. For a writing tool optimized for iPad, that's a meaningfully worse experience than a standalone app that fills the screen.

## What We Did

We added Progressive Web App support to every web frontend in the portfolio - every app in a single session. The work started as a product strategy question for one venture (should we build a native iOS app?) and ended as an infrastructure standard applied everywhere.

The answer to the native app question was no. The validation thesis hasn't been proven yet. A native app means a new codebase, App Store review cycles that slow iteration from instant to 24-48 hours, and $99/year plus 15% commission before the product has earned a dollar. But the web app should at least behave like an app when saved to the Home Screen. Safari 26 defaults every Home Screen addition to standalone mode - we just needed to meet it halfway.

We wrote a PWA standard into the golden path (the portfolio's shared engineering spec) covering manifest requirements, service worker strategy, icon sets, and iOS meta tags. Two framework patterns: Serwist for Next.js apps, @vite-pwa/astro for Astro sites. Then we filed issues across all the repos and spun up a parallel agent team - one agent per venture, all executing simultaneously.

The implementation per app was straightforward: install the framework plugin, create a service worker that precaches the app shell, write a manifest with venture branding, add iOS meta tags to the layout, verify the build passes. The agents ran into the usual integration friction - generated service workers tripping lint rules, CommonJS vs ESM config differences, pre-existing CI failures unrelated to PWA - but nothing that required architectural changes.

All PRs were up within 15 minutes. Reviewed and merged in the same session.

Then we closed the process gap. The new-venture setup checklist had no PWA step, which means the next venture would have shipped without it and someone would have had to retrofit it later. We added Phase 4.7 (PWA Setup) to the checklist with framework-specific instructions, and updated the `/new-venture` skill to include it. Future ventures get PWA support as part of standard setup.

## What Surprised Us

The real problem isn't technical. Apple provides no API to prompt users to install a PWA. On Android, the browser shows a native "Add to Home Screen?" dialog. On iOS, users have to know to tap Share, scroll down, find "Add to Home Screen", and tap Add. For technical users that's discoverable. For the target audience of a nonfiction writing tool - subject-matter experts who are not necessarily technical - it's invisible.

The fix is a guided install prompt: a UI component that detects you're running in Safari (not already installed), waits until you've used the app a few times, then walks you through the steps with visuals showing the actual Safari icons. Every serious PWA on iOS does this. We filed that as a separate issue for the writing tool since it's the venture where Home Screen experience matters most.

The session produced a concrete principle: installability is infrastructure, not a feature. It belongs in the setup checklist next to CI and secrets management, not in the backlog.
