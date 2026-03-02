---
title: 'Adding wireframes to the PM workflow for UI-facing stories'
date: 2026-03-01
tags: ['process', 'design']
draft: false
---

Agents were implementing UI features from text descriptions alone. The product owner would write a story describing a feature, the dev agent would build it, and the implementation often diverged from the specification. Layout assumptions diverged. Flow details got interpreted differently. A visual prototype - even a rough one - gives the dev agent a concrete reference and catches these issues before code is written.

## What we did

We added a new phase to the story lifecycle: wireframing. For any UI-facing story, the PM agent now generates an interactive HTML/CSS wireframe prototype before marking the story ready for development. This sits between story creation and development as Phase 1b in the workflow.

The wireframe phase comes with a new instruction module (`wireframe-guidelines.md`) that contains the prompt template for generating wireframes, file conventions (naming, where to store them), a freeze rule (wireframe is locked once dev starts - changes go through a new issue), and a conflict resolution protocol for when implementation and wireframe diverge during development.

We updated three persona briefs: Dev must reference the wireframe during implementation. PM must generate and link the wireframe before marking a story as ready, and verify builds against it during QA. Captain can override the freeze rule if scope changes mid-implementation. The story issue template got a structured wireframe link field in the Agent Brief section, and the Definition of Ready checklist now includes a wireframe checkbox for UI stories.

New venture setup tooling (the bootstrap script and checklist) now includes a `docs/wireframes/` directory. The setup script creates this directory structure during new venture initialization.

## What surprised us

The friction point wasn't generating the wireframe - any Claude agent handles that well with the right prompt template. Analysis revealed how often "non-UI stories" actually had UI implications. An API endpoint story might be purely backend, but the moment you add request validation or error messages, there's a user-facing component. We ended up clarifying the UI-facing definition: if the story touches anything a user sees or interacts with (UI, CLI output, error messages, confirmation prompts), it needs a wireframe. Pure data layer or infrastructure changes don't.

The freeze rule proved critical to scope discipline. Without it, PM would update the wireframe mid-implementation when the dev agent asked clarifying questions, creating a moving target. The freeze forces those questions to either (a) get resolved within the existing wireframe's constraints, or (b) get filed as a new story if they're actually scope expansion. That discipline keeps stories shippable.
