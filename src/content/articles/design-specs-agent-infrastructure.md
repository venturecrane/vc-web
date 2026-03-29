---
title: 'Design Specs as Agent Infrastructure'
date: 2026-03-28
description: 'Agents building UI from text descriptions produce divergent implementations. Design specs loaded at startup solved this.'
author: 'Venture Crane'
tags: ['design-system', 'agent-workflow', 'process']
draft: false
---

Every time a dev agent built a UI feature from a text story, the implementation diverged. Not wrong, exactly - the code worked, the feature shipped. But layout assumptions diverged from what the PM had imagined. Interaction flows got interpreted differently. Two agents implementing two stories for the same page would produce two different spatial languages. Reconciling them burned rework cycles.

The problem was not the agents. It was the input. Text descriptions are ambiguous. A sentence like "add a sidebar with suggestion cards" can produce a dozen defensible implementations. Humans catch this ambiguity by asking clarifying questions, by pointing at mockups, by having seen the existing UI and developing intuitions about it. Agents do none of that. They build from the literal input they receive.

The fix was adding a concrete visual reference to the workflow before any code gets written.

---

## The Wireframe Phase

We added Phase 1b to the story lifecycle: wireframing. For any UI-facing story, the PM agent now generates an interactive HTML/CSS wireframe prototype before marking the story ready for development. The dev agent has a concrete reference. The divergence problem disappears.

A new instruction module - `wireframe-guidelines.md` - covers the prompt template for generating wireframes, file naming conventions, and two rules that turned out to be critical.

Three persona briefs were updated. Dev must reference the wireframe during implementation. PM must generate and link it before marking a story ready, and verify builds against it during QA. Captain can override the freeze rule if scope shifts mid-implementation.

The story issue template got a structured wireframe link field. The Definition of Ready checklist added a wireframe checkbox for UI stories.

Generating the wireframes was the easy part.

---

## The UI-Facing Definition

The first friction was definitional. "UI-facing stories" sounds obvious until you apply it to a real backlog.

An API endpoint story looks like pure backend work. Add a route, write a handler, return JSON. But add request validation with error messages, and suddenly there is a user-facing surface. Add a confirmation prompt to a CLI command, and that is a user interaction. Add status output to a background job, and an operator is reading that output.

We settled on a simple test - if the story touches anything a user sees or interacts with - UI, CLI output, error messages, confirmation prompts, status indicators - it needs a wireframe. Pure data layer or infrastructure changes do not.

CLI output and error messages are often treated as implementation details, written at the moment the code is written, with whatever formatting seemed convenient. That produces inconsistent command-line experiences across tools, inconsistent error message styles, inconsistent language. Treating them as UI surfaces - with the same visual reference requirement as a graphical panel - brings them into the same quality system.

---

## The Freeze Rule and Why Agents Need It

The second rule was a freeze: once development starts, the wireframe is locked. Changes go through a new issue.

Agents have a failure mode that makes this rule necessary - one that is more acute than with human developers.

When a dev agent asks a clarifying question mid-implementation, a PM agent will answer it. If the answer implies a wireframe change, the PM will update the wireframe. The dev incorporates the change. Now the story scope has expanded with no ticket filed. The wireframe no longer matches the original issue brief. The PM's QA checklist is verifying against something that was modified after development started.

Human developers push back on changing requirements. They flag scope creep. They say "that sounds like a different story." Agents do not do this. They accept new information and incorporate it. A moving target is not a problem for the agent - it is just the current specification. The ratchet only tightens. The story grows.

The freeze rule is scope enforcement that agents cannot provide for themselves. When the wireframe is locked, a clarifying question that implies UI changes has exactly two valid resolutions: handle it within the existing wireframe's constraints, or file a new story. Neither resolution allows silent scope expansion. The story stays shippable.

---

## Design Standardization

Wireframes solved the layout and interaction problem. They introduced a new one.

Agents generating wireframes had no reference for what a venture's UI should look like. What colors, what type scale, what surface hierarchy. Each wireframe started from scratch with generic HTML styling. The result was wireframes that were structurally correct but visually divorced from the production UI they were supposed to resemble. The dev agent building from that wireframe made its own styling choices.

We built per-venture design specs: structured documents containing color tokens, typography scales, surface hierarchies, component patterns, and WCAG contrast ratios for every color pairing. Agents load the spec before generating a wireframe or implementing UI code. The wireframe uses the venture's actual tokens. The dev agent has the same reference when writing CSS.

The specs follow a common naming convention (`--{prefix}-{category}-{variant}`) but each venture owns its own tokens. Some ventures are dark-only. Some support both modes. The spec captures this along with the contrast ratios, so agents know whether a given color combination is accessible before they write it into a component.

---

## Three-Tier Classification

Not every venture has a mature design system. Applying the same expectations to all of them does not work.

We classified ventures into three tiers:

**Enterprise.** Complete token systems with documented component patterns. Agents use what exists, extend it conservatively, and propose any new tokens in the PR for review before they get into the spec.

**Established.** Basic tokens exist but have not been formally structured. Agents work with the existing tokens and may propose formalization - converting ad-hoc CSS values into named custom properties - as part of normal UI work. No invention of new visual language.

**Greenfield.** Minimal foundation or proposed tokens only. Agents propose new tokens in the PR. The Captain reviews and promotes them to the spec. Nothing enters production styling without explicit sign-off.

The tier determines agent behavior concretely. An enterprise venture agent never invents a new color. A greenfield venture agent has to; there is nothing to reference yet. But it proposes rather than decides. The Captain remains the source of truth on what the visual language is for a new product.

An extraction script connects the spec to production code. It reads CSS custom properties from the venture's live stylesheet and generates the token tables in the spec. When the CSS changes, the spec stays current without manual transcription. The spec is not a document someone maintains - it is a view over the production stylesheet.

---

## Lessons

**Design specs are runtime infrastructure, not documentation.**

The distinction matters. Documentation is something humans read occasionally to get context. Infrastructure is something systems consume at startup to function correctly. A design spec that sits in a wiki and gets consulted manually when someone wonders what the primary color is - that is documentation. A design spec that is loaded by every agent at the start of any UI task, that constrains wireframe generation and implementation choices, that is regenerated automatically when CSS changes - that is infrastructure.

Infrastructure gets the properties we demand from other infrastructure: it is version-tracked, it self-heals when it drifts from the source of truth, it is delivered automatically to consumers that need it, it has clear ownership and update protocols.

The wireframe freeze rule is the same pattern applied to process. A constraint that exists not because humans cannot reason about scope creep, but because agents cannot refuse a request. The workflow must encode discipline that agents cannot provide for themselves.

**Agents do not compensate for ambiguous inputs.** They build from them. Every ambiguous input in a story, wireframe, or design spec produces an interpretation that may or may not match what was intended - and the agent will never flag the ambiguity. The system must eliminate the ambiguity before the agent starts.

The wireframe phase is an ambiguity elimination step. The design spec is an ambiguity elimination step. The freeze rule prevents ambiguity from re-entering the story mid-implementation. Each piece of infrastructure in this system is doing the same job: reducing the decision space the agent faces so the remaining decisions are ones it can make correctly.

**Constraints that apply at startup are the most reliable constraints.** Telling an agent mid-task to follow a design spec is advisory. Loading the spec at session start, before any work begins, makes it structural. The agent's first answer to "what are the right colors" is the spec, not a guess, because the spec is what it has.

We have applied this principle beyond design. Process docs load at session start. ADRs load before architectural changes. Wireframes load before implementation. The consistent pattern is: make the reference material unavoidable by putting it at the start of the workflow, not at a step where the agent might already be heading the wrong direction.
