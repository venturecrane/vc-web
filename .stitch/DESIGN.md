# Venture Crane - Stitch Design Spec

Design system definition for Google Stitch project import. Derived from the canonical
`design-spec.md` - when values conflict, design-spec.md wins.

**Project ID:** 3863096177273793001

## Design System Overview

- **Brand:** Venture Crane - AI-native venture studio infrastructure
- **Audience:** Technical founders, AI developers, indie hackers
- **Platform:** Web (Astro, Tailwind v4, Cloudflare Pages)
- **Theme:** Dark-only
- **Voice:** Confident, technical, transparent. Agent-authored content. No apologies, no hiding.

## Color Palette

### Background Surfaces

| Token                 | Hex       | Usage                              |
| --------------------- | --------- | ---------------------------------- |
| `--vc-chrome`         | `#1a1a2e` | Primary background, header, footer |
| `--vc-chrome-light`   | `#1e1e36` | Chrome hover states                |
| `--vc-surface`        | `#242438` | Content card backgrounds           |
| `--vc-surface-raised` | `#2a2a42` | Elevated cards, modals             |
| `--vc-code-bg`        | `#14142a` | Code block backgrounds             |

### Text

| Token               | Hex       | Usage                  | Contrast |
| ------------------- | --------- | ---------------------- | -------- |
| `--vc-text`         | `#e8e8f0` | Primary body text      | 11.7:1   |
| `--vc-text-muted`   | `#a0a0b8` | Secondary, metadata    | 6.3:1    |
| `--vc-text-inverse` | `#1a1a2e` | Text on light surfaces | -        |

### Accent Colors

| Token               | Hex       | Usage                        | Contrast |
| ------------------- | --------- | ---------------------------- | -------- |
| `--vc-accent`       | `#818cf8` | Links, CTAs, focus           | 5.8:1    |
| `--vc-accent-hover` | `#a5b4fc` | Accent hover states          | 7.1:1    |
| `--vc-gold`         | `#dbb05c` | Premium features, highlights | 7.9:1    |
| `--vc-gold-hover`   | `#e8c474` | Gold hover states            | 9.2:1    |
| `--vc-gold-muted`   | `#a08040` | Muted gold accents           | 4.8:1    |

### Borders

| Token         | Hex       | Usage                  |
| ------------- | --------- | ---------------------- |
| `--vc-border` | `#2e2e4a` | Dividers, card borders |

## Typography

- **Body:** System font stack (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)
- **Mono:** ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace
- **Scale:** H1 32px/1.2, H2 24px/1.3, H3 20px/1.4, Body 16px/1.6, Small 14px/1.5, Code 13px/1.4
- **Weights:** System defaults (no custom weights)

## Spacing & Radius

- **Base unit:** 4px (0.25rem)
- **Scale:** Tailwind default (0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)
- **Content width:** 768px max
- **Border radius:** Tailwind defaults (rounded-md for cards, rounded-lg for modals)

## Component Patterns

- **ArticleCard:** Featured article display with metadata, elevated surface
- **PortfolioCard:** Venture showcase cards with status indicators
- **BuildLogEntry:** Chronological build updates, date-stamped
- **HeroSection:** Landing page hero with headline and CTA
- **Header:** Site navigation, logo, horizontal nav (hamburger on mobile)
- **Footer:** Links, copyright, attribution
- **CodeBlock:** Syntax-highlighted with horizontal scroll, inset background
- **SkipLink:** Visually hidden until focused, keyboard accessibility

## Layout

- **Mobile-first responsive:** sm 640px, md 768px, lg 1024px
- **Touch targets:** 44x44px minimum
- **Focus indicators:** 2px solid accent (#818cf8), 2px offset
- **Motion:** Respects prefers-reduced-motion

## Design Principles

1. Content supremacy - typography and readability first
2. Earned complexity - start minimal, add only when justified
3. Performance as brand - fast load times are a feature
4. WCAG 2.1 AA minimum, prefer AAA
5. Quiet differentiation - quality over gimmicks
