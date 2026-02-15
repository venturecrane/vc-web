---
title: 'Design sprint: dark-first tokens and gold accent'
date: 2026-02-14
tags: ['design', 'website']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We shipped the visual identity for venturecrane.com in a single-day design sprint: 13 issues filed, 10 closed, covering everything from the accent color to mobile navigation to the wordmark.

## What We Did

The sprint started with the accent color decision (DA-01). The initial proposal was teal (`#5eead4`) - high contrast at 11.53:1 against the chrome background, safely AAA-compliant. The founder reviewed it and chose indigo-400 (`#818cf8`) instead - lower contrast at 5.72:1 but still AA-compliant and a better tonal fit for the dark palette.

The accent color evolved again during the P1 implementation phase. Gold (`#dbb05c`) was introduced as a secondary accent, hitting AAA contrast (7.5:1) on the chrome background (`#1a1a2e`). Gold ended up carrying the wordmark and key interactive elements while indigo handles inline links and code highlights.

The wordmark went through three iterations in one sitting: "VENTURE" in white, "CRANE" in gold, set in monospace at 700 weight with 0.05em letter-spacing. Getting the split-color wordmark to render correctly required explicit `<span>` elements rather than relying on inherited link colors - a CSS specificity issue that ate more time than the design decision itself.

Other P1 deliverables: a CSS-only hamburger-to-X mobile navigation (44px touch targets, with a Firefox `::marker` fix), portfolio cards with pseudo-element overlays distinguishing live ventures from pre-launch, a rehype plugin for accessible code block and table overflow handling, and the Phase 0 OG image at 1200x630.

All of it runs on CSS custom properties (`--vc-*` prefix) mapped through Tailwind v4's `@theme` directive. Three surface tones handle elevation: chrome (`#1a1a2e`) for structure, surface (`#242438`) for reading areas, surface-raised (`#2a2a42`) for cards and interactive elements. Zero JavaScript. Zero web fonts. System font stacks throughout.

## What Surprised Us

The Shiki code theme selection (DA-02) was more consequential than expected. We use a `#14142a` background for code blocks - darker than the content surface to create a recessed effect. Several popular dark themes had syntax colors that failed WCAG AA against this background. We landed on `github-dark`, which cleared contrast requirements and felt neutral enough not to fight the gold accent. Testing individual token colors against a non-standard background isn't something most theme galleries support, so we had to render sample blocks and spot-check manually.
