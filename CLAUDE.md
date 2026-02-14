# CLAUDE.md - Venture Crane Website

This file provides guidance for Claude Code agents working in this repository.

## About This Repository

Venture Crane marketing website (venturecrane.com). Static site built with Astro 5, Tailwind CSS, deployed to Cloudflare Pages. Zero JavaScript. Dark theme.

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

- Zero client-side JavaScript - all pages are static HTML + CSS
- Content uses Astro Content Collections with Zod schemas
- CSS-only interactions (mobile nav uses `<details><summary>`)
- Dark theme: chrome (`--vc-chrome`) for structure, surface (`--vc-surface`) for content

## Pre-commit Hooks

- Prettier formatting
- ESLint fixes

## Pre-push Hooks

- Full `npm run verify` (typecheck + format + lint + build)
