---
title: 'Wireframes and design specs in the agent workflow'
date: 2026-03-02
tags: ['process', 'design', 'design-system']
draft: false
---

Agents were implementing UI features from text descriptions alone. The product owner would write a story describing a feature, the dev agent would build it, and the implementation often diverged from the specification. Layout assumptions diverged. Flow details got interpreted differently. A visual prototype - even a rough one - gives the dev agent a concrete reference and catches these issues before code is written.

## What we did

We added a new phase to the story lifecycle: wireframing. For any UI-facing story, the PM agent now generates an interactive HTML/CSS wireframe prototype before marking the story ready for development. This sits between story creation and development as Phase 1b in the workflow.

The wireframe phase comes with a new instruction module (`wireframe-guidelines.md`) that contains the prompt template for generating wireframes, file conventions (naming, where to store them), a freeze rule (wireframe is locked once dev starts - changes go through a new issue), and a conflict resolution protocol for when implementation and wireframe diverge during development.

We updated three persona briefs: Dev must reference the wireframe during implementation. PM must generate and link the wireframe before marking a story as ready, and verify builds against it during QA. Captain can override the freeze rule if scope changes mid-implementation. The story issue template got a structured wireframe link field in the Agent Brief section, and the Definition of Ready checklist now includes a wireframe checkbox for UI stories.

New venture setup tooling (the bootstrap script and checklist) now includes a `docs/wireframes/` directory. The setup script creates this directory structure during new venture initialization.

## What we found

The friction point wasn't generating the wireframe - any Claude agent handles that well with the right prompt template. Analysis revealed how often "non-UI stories" actually had UI implications. An API endpoint story might be purely backend, but the moment you add request validation or error messages, there's a user-facing component. We ended up clarifying the UI-facing definition: if the story touches anything a user sees or interacts with (UI, CLI output, error messages, confirmation prompts), it needs a wireframe. Pure data layer or infrastructure changes don't.

The freeze rule proved critical to scope discipline. Without it, PM would update the wireframe mid-implementation when the dev agent asked clarifying questions, creating a moving target. The freeze forces those questions to either (a) get resolved within the existing wireframe's constraints, or (b) get filed as a new story if they're actually scope expansion. That discipline keeps stories shippable.

## Design standardization

Wireframes solved the layout and interaction problem but introduced a new gap: visual consistency. Agents generating wireframes had no reference for what a given venture's UI should look like - what colors to use, what surfaces to stack, what typography to apply. Each wireframe started from scratch with generic styling.

We created per-venture design specs - structured documents containing color tokens, typography scales, surface hierarchies, component patterns, and accessibility requirements. Each spec is accessible through the context API, so agents load it before generating a wireframe or implementing UI code.

The specs follow a common naming pattern (`--{prefix}-{category}-{variant}`) but each venture defines its own tokens and values. Some ventures have dark-only themes, some light-only, some support both. The specs capture this along with WCAG contrast ratios for every color pairing.

Not every venture has a mature design system. We classified them into three tiers: enterprise (complete token systems with documented components), established (basic tokens that need formalization), and greenfield (proposed tokens or minimal foundation). The tier determines agent behavior - enterprise ventures use what exists and extend it, greenfield ventures propose new tokens in the PR for review.

An extraction script reads CSS custom properties from a venture's production stylesheet and generates the token tables in the spec. This keeps specs current as the CSS evolves, without manual transcription.

The wireframe guidelines now require loading the design spec before generating any wireframe. The agent uses the venture's actual tokens, surfaces, and component patterns rather than inventing a visual language for each prototype. The result is wireframes that look like the venture they belong to, not generic HTML mockups.
