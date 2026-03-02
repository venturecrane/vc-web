---
title: 'PWA vs Native App - When to Skip the App Store'
date: 2026-02-18
description: 'A decision framework for choosing PWA over native when you have not validated product-market fit yet.'
author: 'Venture Crane'
tags: ['pwa', 'architecture', 'product-decisions']
draft: false
---

Shipping an iPad app through the App Store costs $99/year, a week of App Store Review roulette, and a commitment to a build toolchain you will maintain for the life of the product. Shipping the same app as a PWA costs a `manifest.json`, a service worker, and a deploy.

We chose the PWA. Not because we are opposed to native apps, but because we had not yet proven that anyone wanted the product.

The case study is a writing app for nonfiction authors, built for iPad-first use. Rich text editing, AI-powered rewrite suggestions, Google Drive sync, PDF and EPUB export. The kind of app that sounds like it should be native. It is not, and the reasons are worth examining.

---

## The Temptation of Native

When you are building for iPad, the gravitational pull toward a native app is strong. App Store distribution. Native performance. The mental model that "serious apps" are native apps.

Here is what a native iOS app actually requires:

- **Apple Developer Program** - $99/year, enrollment approval, provisioning profiles.
- **Build toolchain** - Xcode, Swift/SwiftUI (or React Native with its bridging layer), CocoaPods or SPM for dependencies.
- **App Store Review** - every release goes through Apple's review process. Typical turnaround is 24-48 hours, but rejections happen, and the feedback loop is measured in days.
- **Binary management** - code signing, TestFlight for beta distribution, crash symbolication, app thinning for different device classes.
- **Separate codebase** - unless you use React Native, your iOS app is a distinct codebase from your web app. Two deployment pipelines, two testing strategies, two sets of bugs.

None of this is unreasonable for a validated product. All of it is premature for a product that has not found its audience yet.

---

## What the App Actually Uses

Before deciding on distribution, we listed every technical capability the app requires:

- **Rich text editing** - TipTap, a ProseMirror-based editor. Runs entirely in the browser.
- **AI rewrite streaming** - Server-Sent Events from an API endpoint. The browser renders tokens as they arrive.
- **Google Drive OAuth** - standard OAuth 2.0 flow. Works in any browser.
- **PDF export** - generated via a headless browser rendering service. The client sends content, gets back a PDF.
- **EPUB generation** - JSZip running client-side. No native APIs involved.
- **Offline shell** - service worker caches the app shell. Data still needs network, but the app loads without one.

Every single feature on this list works in Safari on iPad. None of them require ARKit, HealthKit, Core Data, background location, NFC, or any other native-only API.

This is the first question in the decision framework, and it is the most important one: do your features require native APIs? If the answer is no, the argument for a native app shifts from technical necessity to distribution preference. That is a very different conversation.

---

## The PWA Stack

The technical implementation is straightforward enough to describe in a few paragraphs. That is part of the point: the overhead is minimal.

**Web app manifest.** A `manifest.json` file that tells the browser this site can behave like an app. The critical fields:

```json
{
  "name": "Your App Name",
  "short_name": "App Name",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

`display: standalone` is the key property. It tells iOS to render the app without Safari's address bar and navigation chrome. When a user taps "Add to Home Screen," the app launches full-screen, indistinguishable from a native app at the visual level.

**Service worker via Serwist.** Serwist is the successor to next-pwa, which was built on Workbox. It integrates with Next.js through a plugin in `next.config.ts`. The service worker caches the app shell - HTML, CSS, JavaScript, fonts - so the app loads instantly on subsequent visits, even offline.

```typescript
// next.config.ts
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
})

export default withSerwist(nextConfig)
```

The service worker source (`sw.ts`) is typically under 30 lines. It registers precache entries and sets up runtime caching strategies. The build toolchain handles the rest.

**iOS meta tags.** Safari needs additional meta tags beyond the manifest to fully support PWA features:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

These tags control how the app appears when launched from the home screen - status bar style, icon, splash screen behavior.

That is the entire PWA layer. Manifest, service worker, meta tags. No Xcode project, no provisioning profile, no signing certificate.

---

## The Deployment Difference

This is where the practical gap between PWA and native becomes stark.

A native app release: write code, build in Xcode, submit to App Store Connect, wait for review (1-3 days), receive approval or rejection. If rejected, fix the issue, resubmit, wait again. When approved, the update propagates to users over hours to days depending on their device settings.

A PWA release: push to `main`, CI deploys to your hosting provider, users get the new version on their next visit. Total time from merge to production: minutes. There is no review gate, no approval queue, no binary propagation delay.

For a product that has not found product-market fit, this iteration speed is the entire game. You need to ship changes, observe behavior, and ship again. A 3-day feedback loop through App Store Review is workable for a mature product. It is fatal for a product that is still figuring out what it is.

We deployed 14 changes in the first two weeks after launch. Some were bug fixes. Some were feature experiments. Some were UI adjustments based on watching real usage patterns. Every one of those shipped within minutes of merge. In the App Store model, that would have been 14 review cycles, or more realistically, we would have batched changes into 2-3 releases and shipped less frequently, learning slower.

---

## The Decision Framework

When should you choose PWA over native? We use a simple decision tree.

### Choose PWA when:

**You have not validated product-market fit.** This is the strongest signal. If you do not know whether people want your product, do not invest in native distribution infrastructure. Build the fastest possible feedback loop between you and your users. PWA gives you web-speed iteration with app-like UX.

**Your features work in the browser.** Go through your feature list. If every feature runs in a modern browser without native API bridges, you do not need a native app for technical reasons. Rich text editing, real-time streaming, OAuth flows, file generation, offline caching - all of these work in Safari, Chrome, and Firefox today.

**Your target platform has solid PWA support.** iPad Safari supports Add to Home Screen, standalone display mode, service workers, and (since iOS 16.4) web push notifications. The PWA experience on iPad is not second-class. Desktop Chrome and Edge have even stronger PWA support with install prompts and window management.

**You want to iterate without gatekeepers.** App Store Review is not adversarial, but it is a gate. Every release goes through it. Every rejection costs days. If you are iterating rapidly on a product that is still taking shape, that gate slows you down in ways that compound.

**Your team is web-native.** If your engineers write React and TypeScript, asking them to also write Swift is asking them to context-switch across languages, toolchains, and platform conventions. The cognitive overhead is real. A web team shipping a PWA is working in their strongest medium.

### Choose native when:

**You need native-only APIs.** ARKit for augmented reality. HealthKit for health data. Core Bluetooth for hardware peripherals. Background location tracking. NFC. If your core features depend on these APIs, a PWA cannot deliver your product. No amount of service worker cleverness will give you access to the accelerometer data that a fitness app needs.

**App Store distribution is a user acquisition channel.** Some products depend on App Store search as a discovery mechanism. If your users find apps by browsing the App Store, not following links, then being in the store matters for business reasons independent of technical ones. This is a distribution argument, not a technology argument.

**You need background processing beyond service workers.** Service workers can do limited background work - push notification handling, periodic sync (on Android). But sustained background processing - playing audio while the app is backgrounded, tracking a workout, syncing large datasets - requires native capabilities.

**Performance requirements exceed browser limits.** 3D rendering at high frame rates, real-time audio processing, heavy computational workloads. The browser is getting faster every year, but native code with direct GPU access is still faster for demanding workloads. If your product competes on performance, PWA might not be enough.

---

## The Validation Threshold

The framework above handles the "which one" question. The harder question is "when do you switch from PWA to native?"

Our answer: when you have evidence that users want the product AND you have identified specific native capabilities they need.

Evidence is not "we think people will want this." Evidence is measurable:

- **Active users performing the core action.** For a writing app, that means users writing chapters. Not visiting the landing page, not creating an account - writing. The core action is the only metric that matters for validation.
- **Retention.** Users coming back. A burst of signups followed by abandonment is not validation. Users returning to write their second chapter, their fifth, their twentieth - that is validation.
- **Explicit requests for native features.** Users asking for things PWA cannot deliver. "I want to use Apple Pencil pressure sensitivity." "I need Siri Shortcuts integration." "I want to sync via iCloud." These requests are the signal that native distribution would unlock value the PWA cannot.

Until you have all three, a native app is premature optimization of your distribution channel. You are spending engineering time on App Store compliance instead of on the product itself.

The important insight: you can always add native later. A PWA does not prevent a future native app. The web app continues to work. Users who prefer the browser keep using it. The native app becomes an additional distribution channel, not a replacement.

You cannot un-build a native app. Once you have an App Store listing, TestFlight beta users, and a Swift codebase, you are maintaining it. Indefinitely. Even if you decide to focus on the web version, the native app has users who expect updates. Killing a published app creates support burden and user frustration that a PWA you never published does not.

---

## Cross-Project Application

The PWA pattern started with the writing app, then extended to all portfolio projects in the same session. Each project had different functionality, but the PWA layer was identical.

The implementation for each project was mechanical:

1. Add `manifest.json` with project-specific name, colors, and icons.
2. Configure Serwist in `next.config.ts`.
3. Write a minimal service worker source file.
4. Add iOS meta tags to the document head.
5. Deploy.

No project required more than an hour of work for the PWA addition. The pattern is a template, not a design exercise. Once you have done it once, every subsequent project is copy, customize the branding fields, deploy.

This repeatability is itself an argument for the approach. A native app is a bespoke project for each platform. A PWA is a configuration layer on top of your existing web application.

---

## What the PWA Cannot Do

Honesty about limitations matters more than enthusiasm about capabilities.

**No App Store presence.** Your app does not appear in App Store search results. Users cannot stumble upon it while browsing. Discovery depends entirely on your own marketing, SEO, and word-of-mouth channels.

**No native app icon badge behavior.** While web push notifications work on iOS 16.4+, the badging API has limited support. Users will not see an unread count on your home screen icon the way they would for a native app.

**Limited background capability.** The service worker runs when the user opens the app or receives a push notification. It does not run continuously in the background. If your app needs to do work while the user is not looking at it, PWA is constrained.

**No access to some hardware.** Bluetooth, NFC, and certain sensor APIs are unavailable or partially available in Safari. The gap narrows with each iOS release, but it exists today.

**Safari-specific quirks.** Apple's PWA support, while functional, lags behind Chrome's. Features like declarative link capturing, window controls overlay, and some manifest properties that work on Android and desktop do not work on iOS. You are building for the subset of PWA capabilities that Safari supports, which is smaller than the full specification.

These limitations are real. They are also irrelevant if your product does not need the capabilities that are missing. The writing app does not need App Store discovery (it has its own site), does not need background processing (writing is a foreground activity), and does not need hardware access (it is a text editor). The limitations exist. They do not apply.

---

## The Broader Principle

The question "should we build a native app?" is often framed as a technology decision. It is not. It is a capital allocation decision.

Building a native app means allocating engineering time to platform-specific toolchains, review processes, and distribution infrastructure. That time is not spent on the product itself. For a validated product with proven demand, that investment makes sense - native distribution unlocks capabilities and audiences that the web cannot reach.

For an unvalidated product, that investment is a bet placed before the evidence is in. You are spending engineering capital on distribution before you know whether anyone wants what you are distributing. The rational move is to minimize distribution overhead, maximize iteration speed, and defer the native investment until the product itself justifies it.

PWA is not a compromise. It is the correct architecture for the stage of the product. When the app has a thousand active writers returning weekly, we will revisit the native question with data instead of assumptions. Until then, the app ships on deploy, updates in minutes, and runs full-screen on every iPad that opens it.

The App Store will still be there when we are ready for it.

---

_The case study is an iPad-first writing app for nonfiction authors, shipped as a Progressive Web App using Next.js, Serwist, and Safari's standalone display mode. The PWA pattern applied to all portfolio projects in the same session, confirming the implementation is mechanical once the pattern is established. No native app will be built until active usage data justifies the investment._
