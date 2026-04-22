---
title: 'Agents Building UI They Have Never Seen'
date: 2026-03-28
description: 'Seventeen PRs, three editor panels, a navigation redesign, and 40 hours of agent time. The human directing the work has never opened the app in a browser.'
author: 'Venture Crane'
tags: ['frontend', 'agent-workflow', 'product-development']
draft: false
---

Seventeen pull requests merged. Three AI Assist panels built with five states each. A full navigation redesign. Book Outline Mode. A shared component system. Design token migration. Forty-plus hours of agent development time - Claude Code agents, working from design specs.

The human directing all of it has never seen the app rendered in a browser.

It is a deliberate working condition - one that exposed exactly where agents are reliable and where they are not.

---

## The Product Context

The product is a book-writing tool. The core workflow is an editor interface with three parts - a book outline, a chapter editor, and a workspace (the "desk") where all three contexts converge. Each context has an AI Assist panel - a sidebar that accepts prompts, streams responses, and feeds output back into the document.

The panels are not simple. Each one has five states: empty (no content loaded), ready (content available, waiting for input), streaming (model responding), complete (response ready), and error (something went wrong). State transitions have to be explicit, recoverable, and visually clear. A user mid-chapter who hits a network error needs to know what happened and what to do next.

The three panels are `chapter-editor-panel.tsx`, `book-editor-panel.tsx`, and `desk-tab.tsx`. At the end of the work described here, they sat at 376 lines, 287 lines, and 537 lines respectively.

---

## What We Built

The work happened across four sessions with distinct scopes.

**Shared component extraction.** PR #467 extracted three foundational components: `Spinner`, `InstructionInput`, and `PanelStatusHeader`. Before this, all three panels had duplicated implementations of each. Eight additional shared components came out of the same pass. The refactor consolidated action bars, standardized the streaming progress display, and added copy-to-clipboard with a toast notification.

**Accessibility pass.** Also in PR #467: every interactive element got `aria-label` attributes. Status transitions got `sr-only` announcements so screen readers report state changes. Every touch target was verified against the 44px minimum. None of this was requested explicitly - it came out of the component consolidation because it was the right way to write the components.

**Navigation redesign.** PRs #469 and #470 replaced the toolbar navigation with a breadcrumb hierarchy. The floating chapter pill - a small UI element that let users switch chapters - was removed entirely. The breadcrumb handles chapter switching now. This eliminated two separate navigation patterns and replaced them with one.

**Design and polish.** PR #468 added gradient buttons, status icons, and card rows to the AI Assist panels. PR #463 implemented Book Outline Mode in the editor's center area. PR #462 migrated chapter status values to match the design spec. PR #461 replaced hardcoded Tailwind color values throughout the codebase with design tokens.

---

## How Agents Build Without Seeing

The work happened without visual feedback because the design system document provides a complete specification: color tokens, typography scale, spacing conventions, component patterns. The agents operated from that document, from reading existing component code, and from explicit state descriptions in PRs and handoff notes.

A Figma file shows you what a button looks like. A design spec document tells you what a button is: its token references, its hover behavior, its disabled state, its sizing constraints. Agents work from the spec, not the render.

Three things held this together. TypeScript prevented an entire class of structural errors - if a component receives props it does not expect, compilation fails before any code ships. The existing component library gave agents concrete patterns to follow. The handoff system ensured each session began with full context from the previous one - no state was lost between agents.

---

## What Broke

The accessibility work created an invisible risk. `aria-label` values are strings. TypeScript does not validate that they are meaningful. An agent could write `aria-label="button"` on every interactive element and the code would compile cleanly, pass linting, and merge without anyone noticing the failure. We have no way to verify whether the labels we wrote are actually useful to screen reader users without testing with a screen reader.

The five-state panel model exposed a coordination problem. The states are defined in code and described in handoff notes, but there is no single canonical state machine document. When an agent adds Cancel and Start Over recovery paths to the error state, that agent knows what it built. The next agent inherits code and comments. If the recovery paths interact with streaming in unexpected ways - say, a cancel during streaming that leaves the model response buffered - that bug would only appear under specific user timing. We cannot test timing from a text interface.

The navigation redesign removed the floating chapter pill. The breadcrumb made the pill redundant - that was the reasoning. But the pill may have had affordance value we did not account for: a persistent, visible indicator of current position. The breadcrumb communicates the same information, but users habituated to the pill might not find it. We cannot know without watching someone use the interface.

A card component that looks correct in code can collapse incorrectly at 375px. Absolute positioning inside flex items creates layout surprises that are invisible in component code but immediately obvious in a browser. We built and documented this class of problem from previous sessions. But documenting a failure mode is not the same as verifying it did not recur.

---

## What We Learned

**Agents are reliable for structure, unreliable for visual correctness.** Component decomposition, state management, prop interfaces, event handling - all of this can be verified from code. Whether a gradient button looks right on a dark surface cannot.

**Design tokens matter more in this workflow than any other.** When colors are hardcoded as `#1a1a2e`, an agent reading code has to reason about what that value means visually. When colors are `text-primary` from a design system, the agent knows the intent. PR #461 - the token migration - was not cosmetic work. It made subsequent agent work more accurate.

**Handoff quality is a direct multiplier on agent output quality.** The sessions that produced the cleanest PRs were the ones that started with specific state descriptions, concrete problem statements, and explicit success criteria. Vague handoffs produced vague code.

**Visual verification is not optional - it is just deferred.** This workflow does not eliminate the need to look at the interface. The work described here ends with an explicit note in the handoff: the Captain has not seen the panels rendered, and that is the top priority before any new code ships. The agent work built the thing. Human eyes have to verify it.

The dev server starts cleanly. `npm run dev` returns 200 at `localhost:3000`. Everything compiles. Seventeen PRs merged with CI green.

Whether the panels actually look right is a question this article cannot answer.

---

## The Practical Takeaway

The constraint is not agent capability. It is the feedback loop. Agents need a way to know whether what they built looks correct. Today that feedback comes from design specs, TypeScript, and human review of rendered output. Until agents can evaluate visual output directly - either through browser access or design tool integration - visual verification remains a human step.

That step cannot be skipped. It can only be scheduled.
