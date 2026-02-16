---
title: 'Site restructure: navigation, content pages, and ship log schema'
date: 2026-02-16T18:00:00
tags: ['website', 'content']
draft: false
---

We restructured venturecrane.com's navigation, renamed three pages, rewrote three content pages, and added a new one. The external feedback that triggered this was direct: the site had strong practitioner content but read like a personal notebook rather than a studio with a thesis.

## What We Did

The navigation dropped "Home" (the logo links home), renamed "Guide" to "Start Here", "Methodology" to "The System", and "Build Log" to "Ship Log". A new "Open Problems" page went into the nav. The "Build Log" to "Ship Log" rename touched 11 non-historical files including TypeScript type unions, OG image generators, and component text. Historical log entries kept their original references.

301 redirects cover every old URL. The existing `_redirects` file already handled WordPress-era paths, so we added `/guide/` to `/start-here/`, `/methodology/` to `/the-system/`, and updated the existing `/about/` redirect to point to `/the-system/` directly instead of double-redirecting through the old path.

The System page got the biggest rewrite. The old "How We Work" page described the session lifecycle but didn't plant a flag. The new version opens with a thesis ("AI agents are productive when they operate inside constraints"), names four beliefs, defines six primitives (Sessions, Handoffs, Context, Tools, Environments, Secrets), and links each to the article that covers it. The page now functions as vocabulary for the rest of the site.

Start Here added audience-based entry paths at the top - solo founders get pointed to costs and kill discipline, teams get pointed to protocols and sessions, explorers get sent to The System first. The Architecture Decisions section got dissolved: the decommissioning article moved to Keeping Agents Reliable (it's kill discipline applied to infrastructure) and the design system article moved to Infrastructure.

Open Problems is new. Two sections: current experiments (cross-session learning, multi-venture drift detection) and unsolved problems (agent cost attribution, debugging reasoning failures, context pressure degradation, sharing agent-native context with new contributors, workflow-level testing). Each experiment names what we're measuring. Each unsolved problem links back to The System's primitives where applicable.

The homepage hero changed from a tagline ("Reliable AI-Native Development for Small Teams") to a concrete description of what the site is ("Field Notes from Running AI Agent Teams in Production"). A "New here?" pointer below the hero gives first-time visitors a path before they scroll past ten content items. The bottom section changed from restating the hero to a "Go Deeper" navigation hub linking to The System, Start Here, and Open Problems.

The ship log content schema picked up four optional frontmatter fields: `shipped`, `impact`, `surprise`, and `nextConstraint`. The Log layout renders a summary block above the prose when any field is present. Existing entries build unchanged.

## What Surprised Us

Every content page went through a write-then-review cycle. The first drafts were structurally sound but had consistent problems: thesis sections that restated each other, article annotations that described what an article was rather than why you'd read it, and section intros that did meta-narration ("This page describes...") instead of delivering content directly. The review pass caught overlap between beliefs and primitives, uneven weight across the six primitives, audience paths that named articles without linking them, and a bottom-of-page thesis that repeated the hero word for word.

The pattern: first drafts optimize for completeness, review passes optimize for reader experience. Both are necessary but they solve different problems.
