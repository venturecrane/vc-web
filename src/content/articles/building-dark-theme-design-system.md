---
title: 'Building a Dark-Theme Design System with Tailwind v4'
date: 2026-02-14
description: 'How we built a dark-first design system using CSS custom properties and Tailwind v4 theme configuration.'
author: 'Venture Crane'
tags: ['design-system', 'tailwind', 'css', 'dark-theme']
draft: false
---

Most design system guides start with light mode and bolt dark mode on as an afterthought. We went the other direction. Venture Crane's site was designed dark-first - every color token, every contrast ratio, every surface elevation was conceived for a dark canvas. Here's what we learned building it with Tailwind CSS v4 and vanilla CSS custom properties.

## Why Dark-First

The conventional approach treats dark mode as an inversion. You design for white backgrounds, then flip to dark with `prefers-color-scheme`. This works, but it produces dark themes that feel like negatives of the light version rather than intentional designs.

We had a specific reason to go dark-first: Venture Crane is a development lab. Our audience is practitioners - developers and technical founders who spend most of their screen time in dark terminals and IDEs. A dark reading surface isn't an accommodation; it's the default expectation.

There's a practical benefit too. When you design dark-first, you're forced to think about elevation through surface tones rather than shadows. Shadows barely register against dark backgrounds. This constraint produced a cleaner hierarchy system than we'd have arrived at starting with light mode.

## The Token Architecture

### Three Layers of Color

Our system uses three semantic layers for background surfaces:

1. **Chrome** (`#1a1a2e`) - structural elements like the header, footer, and homepage background
2. **Surface** (`#242438`) - content reading areas where long-form text lives
3. **Surface Raised** (`#2a2a42`) - cards, code blocks, and interactive elements that float above the surface

The chrome-to-surface transition is deliberate. When you navigate from the homepage to an article, the reading area shifts from `#1a1a2e` to `#242438` - a subtle but noticeable increase in lightness that signals "you're in reading mode now." It's only 6 points different in lightness, but your eyes register it immediately.

### Custom Properties Over Theme Extensions

Tailwind v4 introduced a `@theme` directive that maps directly to CSS custom properties. We use a two-tier system:

```css
:root {
  /* Source tokens - the actual values */
  --vc-chrome: #1a1a2e;
  --vc-surface: #242438;
  --vc-surface-raised: #2a2a42;
  --vc-text: #e8e8f0;
  --vc-text-muted: #a0a0b8;
  --vc-accent: #818cf8;
  --vc-accent-hover: #a5b4fc;
  --vc-gold: #dbb05c;
  --vc-gold-hover: #e8c474;
  --vc-border: #2e2e4a;
  --vc-code-bg: #14142a;
}

@theme {
  /* Tailwind mappings - reference the source tokens */
  --color-chrome: var(--vc-chrome);
  --color-surface: var(--vc-surface);
  --color-surface-raised: var(--vc-surface-raised);
  --color-accent: var(--vc-accent);
  --color-gold: var(--vc-gold);
  --color-border: var(--vc-border);
}
```

This looks like unnecessary indirection, but it serves a purpose. The `:root` tokens are plain CSS - any stylesheet, component `<style>` block, or third-party library can reference them. The `@theme` block maps these into Tailwind's utility class system so `bg-surface` and `text-accent` work in class attributes. One set of values, two consumption patterns, zero duplication.

### Contrast Ratios

Every color pairing was checked against WCAG AA (4.5:1) and AAA (7:1) thresholds. Here are the key ratios:

| Pairing         | Foreground | Background | Ratio  | Grade |
| --------------- | ---------- | ---------- | ------ | ----- |
| Body text       | `#e8e8f0`  | `#242438`  | 11.2:1 | AAA   |
| Muted text      | `#a0a0b8`  | `#242438`  | 5.4:1  | AA    |
| Accent links    | `#818cf8`  | `#242438`  | 5.8:1  | AA    |
| Gold wordmark   | `#dbb05c`  | `#1a1a2e`  | 7.5:1  | AAA   |
| Code text       | `#e8e8f0`  | `#14142a`  | 14.1:1 | AAA   |
| Muted on chrome | `#a0a0b8`  | `#1a1a2e`  | 6.2:1  | AA    |

The gold accent (`#dbb05c`) was specifically tuned to clear AAA on the chrome background. An earlier candidate (`#d4a855`) only hit 6.9:1 - technically AA-compliant, but uncomfortably close to the boundary. We bumped it to `#dbb05c` for margin.

## Typography Decisions

### The 18px Body Default

We set body text to `1.125rem` (18px) with a `1.7` line height. This is larger than typical web defaults (16px) but maps to comfortable dark-mode reading.

Dark backgrounds demand slightly larger text. The same optical illusion that makes white text on black appear bolder than black text on white also makes small text harder to parse. At 18px with generous line height, sustained reading is comfortable without feeling oversized.

On mobile (below 640px), we drop to `1rem` (16px) with a `1.6` line height. The reduced viewport makes 18px feel disproportionate.

```css
:root {
  --vc-text-body: 1.125rem;
  --vc-leading-body: 1.7;
}

@media (max-width: 640px) {
  :root {
    --vc-text-body: 1rem;
    --vc-leading-body: 1.6;
  }
}
```

### System Font Stacks

We avoided loading custom fonts entirely. The font stack falls through platform natives:

- **Body:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif`
- **Mono:** `ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, 'DejaVu Sans Mono', monospace`

Zero font files means zero layout shift from font loading, zero FOUT, and one fewer thing to cache-bust. Every operating system ships a good sans-serif and a good monospace. Use them.

### The Type Scale

We defined a five-step scale covering everything from page titles to metadata:

| Element    | Size            | Line Height | Weight |
| ---------- | --------------- | ----------- | ------ |
| H1         | 2.25rem (36px)  | 1.2         | 700    |
| H2         | 1.75rem (28px)  | 1.3         | 600    |
| H3         | 1.375rem (22px) | 1.4         | 600    |
| Body       | 1.125rem (18px) | 1.7         | 400    |
| Small/Meta | 0.875rem (14px) | 1.5         | 400    |

Each step is roughly a 1.25x ratio - not a mathematically perfect scale, but one tuned for readability at each individual level. Strict modular scales often produce awkward sizes at the extremes. We preferred each level looking right on its own.

## Component Patterns

### Prose Container

All rendered markdown lives inside `.vc-prose`, which applies spacing, list styles, and link colors. This is a deliberate alternative to Tailwind's official `@tailwindcss/typography` plugin.

> We avoided the typography plugin because its reset approach conflicted with our token system. When you've already defined `--vc-text` and `--vc-accent` as CSS variables, layering on a plugin that generates its own color values creates a maintenance surface. One source of truth is better than two.

The `.vc-prose` class handles:

- Heading margins (`margin-top: 2em` for h2, `1.5em` for h3)
- Paragraph spacing (`margin-bottom: 1.25em`)
- List indentation (`padding-left: 1.5em`)
- Blockquote styling (accent-color left border, muted italic text)
- Table formatting (collapsed borders, raised-surface header background)
- Inline code (raised-surface background with slight padding)

### Code Block Overflow

Code blocks need special treatment in constrained layouts. A 680px content width can't fit an 120-character line without overflow. We handle this with three layers:

1. `overflow-x: auto` on the `<pre>` element
2. `tabindex="0"` added via a rehype plugin for keyboard scrollability
3. A CSS `::after` pseudo-element creating a right-edge fade gradient

The fade gradient is the subtlest detail. When a code block has horizontal overflow, the right edge just... ends. There's no visual signal that more content exists. The sticky pseudo-element creates a 2rem fade from transparent to the code background color, hinting at overflow without obscuring content:

```css
pre::after {
  content: '';
  position: sticky;
  right: 0;
  display: block;
  width: 2rem;
  height: 100%;
  margin-top: -100%;
  background: linear-gradient(to right, transparent, var(--vc-code-bg));
  pointer-events: none;
}
```

No JavaScript. No intersection observers. Just CSS doing what CSS does well.

### Table Scroll Shadows

Tables face the same overflow problem as code blocks, but we solve it differently. A rehype plugin wraps each `<table>` in a `<div class="table-wrapper">` with `role="region"` and `tabindex="0"` for accessibility. The wrapper handles scrolling.

The clever part is the scroll shadow technique using `background-attachment: local` versus `scroll`. Four gradient backgrounds create shadow indicators that appear only when content is scrollable in that direction:

```css
.table-wrapper {
  overflow-x: auto;
  background:
    linear-gradient(to right, var(--vc-surface), var(--vc-surface)) local,
    linear-gradient(to left, var(--vc-surface), var(--vc-surface)) local,
    linear-gradient(to right, rgba(0, 0, 0, 0.25), transparent) scroll,
    linear-gradient(to left, rgba(0, 0, 0, 0.25), transparent) scroll;
  background-size:
    2rem 100%,
    2rem 100%,
    1rem 100%,
    1rem 100%;
  background-position: left, right, left, right;
  background-repeat: no-repeat;
}
```

The `local` backgrounds scroll with the content; the `scroll` backgrounds stay fixed. When you scroll right, the left `local` gradient moves away, revealing the left `scroll` shadow. It's CSS-only, performant, and degrades gracefully - if a browser doesn't support `background-attachment: local`, you just don't get shadow indicators.

## Lessons Learned

### Token Naming Matters More Than Values

We initially named our colors `--bg-dark`, `--bg-medium`, `--bg-light`. This fell apart immediately when discussing designs: "Use the medium background" told you nothing about intent. Renaming to `chrome`, `surface`, and `surface-raised` made every conversation clearer. The name describes the role, not the lightness.

### Test at the Extremes

Our reading comfort check isn't "does this look okay for 30 seconds." It's "can I read this for 5+ minutes without wanting to adjust brightness." Dark themes fail in sustained reading far more often than in quick glances. The combination of 18px text, 1.7 line height, and the `#242438` surface (slightly lighter than the chrome) was the result of iterating through seven background candidates.

### Don't Build What Astro Gives You

We started writing a custom Markdown processing pipeline before realizing Astro's built-in content collections already handled 90% of what we needed. The only custom piece is a single rehype plugin that adds `tabindex` attributes and wraps tables. Everything else - frontmatter parsing, type-safe schemas, slug generation, RSS feeds - is Astro out of the box.

The best code is the code you delete. The second best is the code you never write.
