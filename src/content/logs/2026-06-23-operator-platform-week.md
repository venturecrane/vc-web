---
title: 'Connector Platform, Console Correction, Durable Execution, and the Ops Handbook'
date: 2026-06-23
tags: ['agents', 'infrastructure', 'architecture', 'agent-operations']
draft: true
shipped: 'MCP-first connector platform with the first wired customer connector; management console doctrine; durable task-execution substrate (ledger + broker socket + tests); in-product operations handbook'
---

This was a hardening week. Every item came from the same pressure: a real customer deployment surfacing what the platform actually needs to work unattended.

## Connector Platform

The AI employee product we build reaches customer systems through connectors - email, calendar, practice management, documents, payments. This week we settled the connector architecture and made it real: MCP-first, with author-built adapters only where no first-party MCP exists.

The prior approach had accumulated dead weight. Several build adapters had been wired in the configuration schema but never actually materialized into tools at runtime - a config entry the agent believed in but that produced nothing. We deleted them. What remains: the MCP-first path (vendor-official MCP servers boot as child processes from the per-profile config; there is no in-tree code), the workspace broker for Google (a separate process holding the domain-wide-delegation credential, so the agent never holds the Google credential directly), and a capability contract that captures the set of capability names the platform can reference.

The first real customer connector - a staging seat against a legal practice-management system via its official MCP - is wired. That makes the MCP-first path a runtime reality, not just a decision.

## Console Discipline

A page-by-page review of the operator client portal found drift. Vertical concepts from a specific customer segment had been baked into product structure: a typed matter reference, a hardcoded litigation lifecycle, and a draft-approval action that let the portal reach into the client's work. A matter-detail surface was rendering the client's own case data inside the product.

The decision was clean: the portal is the management console for the client's AI employee. It does three jobs - direct (what the employee is and what it may do), account (the governance record of what it did), and administer (the relationship). It is not a window into the client's systems. Client data belongs in the client's tools; the portal manages the actor, not the work.

The audit log stays metadata-only: timestamp, actor, action class, connector, entitlement basis, outcome. Not bodies, facts, or any content the employee handled.

The content pages and send-action button that violated this boundary are out. The one useful idea inside the old data surface - grouping the employee's actions by the object they pertained to - survives as grouping by opaque connector reference, now general across any vertical instead of law-specific.

## Durable Task-Execution Substrate

The problem was concrete: a long task had run as one synchronous turn against a hard reply timeout, exhausted the budget without finishing, and restarted from zero. Money spent, no result delivered.

The substrate we built addresses Class-D work - multi-step, unattended, too long for one turn. The design grounds itself in what the runtime already provides rather than building new infrastructure: the session lineage already exists in an append-only state store (new session forks are created at compaction, not replacements), so a job resume reads the lineage forward from the last recorded tip and repairs any interrupted tool call before continuing. A separate process holds the job ledger and the authorization boundary; the agent process can read job state but all privileged writes go through a socket the broker owns, so the agent cannot modify its own job control state.

What shipped: the broker-owned job ledger (a mutable control-plane table alongside the existing append-only audit log), the broker socket verbs for job intake, claim, heartbeat, and cancel, lease fencing via a monotonic epoch on every privileged write, pre-spend cost enforcement from real token accumulation rather than estimates, and the idempotency record-before-effect pattern for side-effecting steps. Tests cover the durability scenarios: crash after a journaled effect, lease-epoch fencing against a respawned predecessor, the readiness barrier on boot that prevents a half-wired worker from claiming jobs.

The runtime worker thread that ties all of this together - the in-gateway background thread that executes the resume loop - is the remaining integration work. The substrate is the load-bearing foundation; the worker builds on top of it.

## Operations Handbook

We built and shipped the Venture Handbook: a franchise operations manual for the platform, comprehensive enough that a zero-context successor could run, build, and grow the product from it alone. Thirty-one pages covering business model, product architecture, system layout, and operations, rendered as an in-product surface at the admin console.

The handbook lives in the repository alongside the code. The maintenance contract is mechanical: a change to the venture changes the adjacent handbook page in the same pull request. A structural gate in CI enforces this - a cited source file that no longer exists fails the build. The combination of in-repo placement and a hard gate is what keeps a handbook from drifting into fiction.

## What surprised us:

The connector cleanup revealed how much dead weight accumulates in configuration when the runtime doesn't validate it. Three build adapters had entries in the connector schema, appeared in per-customer config, and the agent would attempt to use them - but no runtime code actually materialized them into tools. Silent no-ops that looked like wired integrations. Deleting them was the right call; a binding that produces nothing is not a fallback, it is a liability.

## What's next:

Wire the in-gateway background worker thread, prove a long Class-D job completes through the substrate, and run the first live session against the wired staging connector.
