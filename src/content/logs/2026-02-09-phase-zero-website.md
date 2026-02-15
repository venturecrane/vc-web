---
title: 'Shipping the website in a single build cycle'
date: 2026-02-09
tags: ['website', 'launch']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We shipped the entire venturecrane.com foundation in roughly 33 hours - from empty repository to published site with articles, build logs, portfolio, methodology page, RSS feed, security headers, and automated deployment.

## What We Did

The stack is Astro 5 with static output, Tailwind v4 with CSS custom properties, and Cloudflare Pages for hosting. No JavaScript runtime. No web fonts. System font stacks throughout. The site generates static HTML at build time and deploys on every push to main.

Content lives in three Astro content collections - articles, build logs, and pages - each backed by markdown files with Zod-validated frontmatter. This separates authoring from code: adding a new article means creating a markdown file, not touching components.

The design system uses CSS custom properties with a `--vc-*` prefix, mapped through Tailwind's `@theme` directive. Three surface tones handle elevation (chrome for structure, surface for reading areas, surface-raised for cards). The accent color went through three iterations in one day - teal, then indigo, then gold as a secondary warm accent. The wordmark ("VENTURE" in white, "CRANE" in gold) required explicit `<span>` elements to override inherited link colors.

The CI pipeline runs on every push: npm install, format check, lint, typecheck, build, npm audit, and Lighthouse CI with thresholds at 95+ for performance, accessibility, and best practices. Lighthouse runs three times and takes the median to avoid flaky scores. After CI passes, Cloudflare Pages deploys automatically.

WordPress compatibility redirects catch old URLs - admin paths, feed aliases, category archives, pagination - and route them to the new structure. Security headers lock down CSP, frame options, and referrer policy.

The site launched with one published article, five retroactive build logs, a portfolio page pulling from venture data, legal pages, a methodology page, and an RSS feed that merges articles and logs.

## What Surprised Us

Inlining CSS was the difference between passing and failing Lighthouse. Astro's default of loading stylesheets as external files added a render-blocking request that dropped performance scores below the 95 threshold. Switching to `build:inlineStylesheets` eliminated the request and stabilized scores. For a static site with modest CSS, inlining is strictly better - the tradeoff between file size and request count tips toward fewer requests when the total CSS is small.
