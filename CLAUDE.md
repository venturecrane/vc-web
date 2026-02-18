# CLAUDE.md - Venture Crane Website

This file provides guidance for Claude Code agents working in this repository.

## About This Repository

Venture Crane marketing website (venturecrane.com). Static site built with Astro 5, Tailwind CSS, deployed to Cloudflare Pages. Zero JavaScript. Dark theme.

## Session Start

This repo does not currently have Crane MCP integration. Enterprise rules apply manually. See crane-console for the full module system.

## Enterprise Rules

- **All changes through PRs.** Never push directly to main. Branch, PR, CI, QA, merge.
- **Never echo secret values.** Transcripts persist in ~/.claude/ and are sent to API providers. Pipe from Infisical, never inline.
- **Verify secret VALUES, not just key existence.** Agents have stored descriptions as values before.
- **Never auto-save to VCMS** without explicit Captain approval.
- **Scope discipline.** Discover additional work mid-task - finish current scope, file a new issue.
- **Escalation triggers.** Credential not found in 2 min, same error 3 times, blocked >30 min - stop and escalate.

## Build Commands

```bash
npm install             # Install dependencies
npm run dev             # Local dev server
npm run build           # Production build
npm run preview         # Preview production build
npm run typecheck       # Astro check
npm run lint            # Run ESLint
npm run format          # Format with Prettier
npm run verify          # Full verification (typecheck + format + lint + build)
```

## Tech Stack

- Framework: Astro 5 (SSG)
- Styling: Tailwind CSS v4 + CSS custom properties
- Hosting: Cloudflare Pages
- Language: TypeScript (strict)
- Fonts: System font stacks (zero web fonts)

## Design Tokens

All design tokens are CSS custom properties prefixed `--vc-*` defined in `src/styles/global.css`. Tailwind is configured to reference these properties - never hardcode hex values in templates.

## Code Patterns

- Minimal client-side JavaScript (contact form enhancement only) - all other pages are static HTML + CSS
- Content uses Astro Content Collections with Zod schemas
- CSS-only interactions (mobile nav uses `<details><summary>`)
- Dark theme: chrome (`--vc-chrome`) for structure, surface (`--vc-surface`) for content

## CSS Pitfalls

- **Absolute positioning inside flex items.** If an element has `position: relative` and is a flex child, its absolutely-positioned children are constrained to that flex item's content width - not the parent flex container. Mobile nav dropdowns, tooltips, and popovers must use a full-width ancestor as the positioned parent.
- **Mobile overflow diagnosis.** If content is clipped on mobile, trace the actual container chain (widths, padding, overflow, position context) before applying fixes. `overflow-x: hidden` on html/body is a band-aid, not a diagnosis. The standard `pre { overflow-x: auto }` pattern works - if it appears broken, the bug is in the container chain or positioning context.
- **Content width budget.** `--vc-content-width` (768px) is the outer container. After main padding (px-4/px-6) and card padding (p-4/p-6/p-8), actual prose width is ~660px. Code blocks get less after pre padding. Keep this in mind when writing content with wide tables or code.

## Pre-commit Hooks

- Prettier formatting
- ESLint fixes

## Pre-push Hooks

- Full `npm run verify` (typecheck + format + lint + build)
