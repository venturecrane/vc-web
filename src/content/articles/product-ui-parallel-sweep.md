---
title: "Building a Product's Entire UI in a Two-Day Parallel Agent Sweep"
date: 2026-06-09
description: 'A client portal and an admin console, built in two days by agents working in parallel, each owning one surface, on a shared dual-mode abstraction.'
author: 'Venture Crane'
tags: ['agent-operations', 'methodology', 'parallel-execution', 'frontend']
draft: false
---

We built both user interfaces for a product in two days. One is the client portal, where the firm using our AI employee product watches what it does and shapes what it may do. The other is the admin console, where we operate the fleet of those agents. Together they are roughly thirty pull requests, most of them merged on a single day, written by a team of agents working in parallel where each agent owned one surface.

This is the execution proof of a methodology we wrote up earlier in [plan-declared workstreams](/articles/plan-declared-workstreams): the idea that a plan should declare its own execution topology, so that the approval gate covers both what gets built and how it gets built in parallel. That article is about the gate. This one is about what happens when you actually fan out a large, coherent UI build across many agents at once, and what makes that tractable instead of chaotic.

This is a build-log honest account. Some surfaces are wired to live data; several are deliberately staged at a read-only state with the operable path built but switched off. We will be clear about which is which.

---

## Why a UI build resists parallelism

The naive reason to build a UI serially is shared surface area. Two agents editing the same layout component, the same navigation, the same auth gate, produce merge conflicts that erase any wall-clock gain. A product UI looks like a single artifact: a coherent set of pages with shared chrome, shared design tokens, shared access rules. Split it carelessly and every agent touches everything.

The thing that made this build splittable was a shared abstraction landed first, before anyone fanned out. Most of the surfaces in both interfaces are the same shape: a domain that the client may or may not be allowed to operate, presented either as something you can change or as something you can only read and request a change to. Rather than have each surface re-implement that decision, we built one dual-mode wrapper component. It takes a domain, resolves whether the current user may operate it by composing the granted authority with the user's role, and renders either an operable slot or a read-only slot with a "Request a change" form. The decision logic lives in a frozen foundation seam; the wrapper is just the shell that picks a slot.

Once that wrapper existed, a surface was no longer a from-scratch page. It was a wrapper plus a domain-specific read function plus a couple of slot components. Two agents building two different surfaces touched almost no shared files, because the shared part was already done and frozen. That is the precondition the earlier article requires: disjoint file scope. Here it was not achieved by luck, it was manufactured by landing the abstraction first.

---

## How the sweep was sequenced

The build was not a single flat wave of thirty PRs. It was a foundation, then two parallel tracks, each a stacked sequence of surface PRs.

The foundation went first as a small, standalone change: a role rename to clear a name collision (the client-internal human roles became `principal`, `staff`, and `compliance`), plus the dual-mode wrapper and the capability matrix that the wrapper consults. That PR shipped the wrapper fully unit-tested but consumed by no page yet. Its first live consumer was the next PR in the sequence. Landing a shared primitive ahead of its first use, and testing it as a primitive, is what let the surfaces that followed treat it as bedrock.

Then the two tracks ran in parallel. On the client portal, agents built Home, Activity and Audit, Matters, Connections, and Configure, each its own PR, each on the frozen foundation. On the admin console, a different set of agents built the fleet roster, the authority panel, the trust and governance surface, and the connectors and credentials surface. The two tracks shared the foundation and almost nothing else. They were genuinely independent workstreams in the sense the methodology requires: no file overlap, no output dependency, real wall-clock gain from running them at once.

Within each track the PRs were stacked rather than independent, because a portal's surfaces share an information architecture that evolves as you add them. A new surface repoints a card on the Home page; the next surface repoints another. Stacking those changes and merging bottom-up kept the navigation coherent at every step instead of producing a pile of PRs that each assumed a different version of the nav. The cost of stacking is merge discipline: agents had to flag each other before merging surfaces that read the same role data, and rebase when a sibling landed first. That coordination is real overhead, and it is the price of parallelism on a shared IA.

---

## The discipline that kept thirty PRs from lying

The risk in a fast parallel UI build is not conflicts. It is fabrication. A surface that renders a plausible empty state, a health dot that is green because green is the default, a review queue that shows zero items because the read path is not wired yet and zero is what an unwired read returns. Multiply that by thirty PRs from different agents and you can ship an entire product UI that looks finished and lies about the state of the system underneath it.

So the same honesty rules ran through every surface, and they show up over and over in the PRs because they were load-bearing, not decorative.

Surfaces that read a runtime path the product has not fully wired yet gate on whether that path is configured. When it is not, they render an honest empty list and deliberately do not emit a read-audit row on every page view, because logging an "unreachable" read on a surface nobody can populate yet is itself a kind of lie about activity. The fleet roster's health column takes the more alarming of two signals rather than the more reassuring one, and a gray health dot explicitly does not mean healthy. The Home page keeps its needs-attention count at zero rather than inventing a queue, because a fabricated review queue is exactly the failure mode an earlier architecture decision was written to forbid.

The governance surfaces carry the sharpest version of this. An action class with no configured ceiling renders as unconfigured and fail-closed, never as a presumed "drafts for review." That default was a real landmine in the system's history, and several PRs reference not reintroducing it by name. The admin write surfaces record intent to a git source of truth and explicitly do not mutate the live read replica, with a test asserting the flip does not touch the replica. Where a backend was not built, the surface offers a "Request a change" path rather than a disabled button onto nothing, which is both honest and a real exercise of the dual-mode wrapper.

None of that is glamorous, and all of it is the actual work. The wrapper made the surfaces cheap to build in parallel. The honesty rules made the parallel output trustworthy. Without the second, the first just lets you ship a confident facade faster.

---

## What is wired and what is staged

Several client surfaces read real authored configuration data and render it live. Others are routed through a runtime read path that is frozen and gated, so they fail closed to honest-empty until that path is populated. Most operable controls ship switched off by design: the dual-mode wrapper renders the read-and-request view at launch, and the operable view appears when we flip the corresponding authority switch from the admin side. The connectors surface is the first to exercise both slots, because client self-service on credential custody is one place where handing control to the client is a security upgrade rather than a risk.

A later redesign reshaped the admin navigation into a flow-ordered information architecture and added account, services, and billing surfaces that compose view-side from the tables that already exist, with the underlying spine table deferred and no revenue numbers fabricated where the schema has no home for them yet.

The transferable lesson is the order of operations. Parallelism across a coherent UI is not free and is not won by spawning more agents. It is won by landing the shared abstraction first and freezing it, so that the surfaces built on top of it have disjoint file scope by construction. The plan declares the workstreams; the frozen seam is what makes the declaration honest. And because the speed lets you ship a finished-looking facade faster than you can verify it, the honesty rules have to be uniform across every agent's surface, or a two-day sweep produces a product UI that is confident and wrong.
