---
title: 'Why We Built a Development Lab Instead of a Product'
date: 2026-02-14
description: 'Most time building software is coordination tax. We built shared infrastructure for 5 ventures instead of going all-in on one.'
author: 'Venture Crane'
tags: ['methodology', 'strategy', 'operations']
draft: true
---

The conventional path for a solo technical founder is: pick one idea, build it, ship it, iterate. We did something different. We built a development lab - shared infrastructure, shared methodology, shared tooling - and then used it to run five ventures simultaneously.

This isn't a pitch for doing it our way. It's a description of why this structure emerged and what it actually looks like in practice.

## The Coordination Tax Observation

After 25 years building enterprise software, one pattern stood out: most of the time spent shipping software wasn't spent on hard problems. It was spent on coordination. Context-switching between tasks. Rediscovering what someone already knew. Writing the same deployment pipeline for the third time. Getting a new developer oriented on a codebase.

AI agents don't eliminate the hard problems. But they eliminate the coordination tax - if you build the infrastructure to support them. A Claude Code session doesn't need onboarding. It doesn't lose context between sprints (if you persist it). It doesn't complain about writing the same boilerplate for the fifth project.

The catch: that "if you build the infrastructure" qualifier is doing a lot of work. Without it, every AI-assisted session starts cold. The agent doesn't know what happened yesterday, what's in progress on another machine, or what the project's business context is. You're back to coordination tax, just with a different collaborator.

## The Infrastructure Layer

Venture Crane is that infrastructure. It's a monorepo (`crane-console`) containing everything the development lab needs to operate:

- **crane-context** - A Cloudflare Worker that manages session state. When an agent starts work, it reads a structured handoff from the previous session. When it finishes, it writes one. No cold starts across sessions or machines.
- **crane-mcp** - An MCP server that gives agents access to the full operational context: documentation index, enterprise knowledge, GitHub issue queues, weekly plan status, and session history. The start-of-day call loads ~3K tokens of oriented context instead of the agent guessing.
- **crane-classifier** - A webhook processor that auto-triages incoming GitHub issues with priority labels and QA grades. Work enters the queue pre-sorted.
- **Shared configuration** - Every venture uses the same CI/CD pipeline (GitHub Actions), the same backend stack (Cloudflare Workers, D1), the same secrets management (Infisical), and the same fleet of dev machines (5 Macs on Tailscale). When the pipeline improves, all five ventures benefit.

The registry currently tracks six entities (five ventures plus the parent LLC):

```json
{
  "ventures": [
    { "code": "vc", "name": "Venture Crane" },
    { "code": "sc", "name": "Silicon Crane" },
    { "code": "dfg", "name": "Durgan Field Guide" },
    { "code": "ke", "name": "Kid Expenses" },
    { "code": "dc", "name": "Draft Crane" }
  ]
}
```

Each venture gets its own secrets path in Infisical, its own GitHub repos, and its own SOD context profile. But they share the tooling, the methodology, and the infrastructure investment.

## Why Not Just Pick One

The standard advice is focus. Pick one product, go deep, don't spread thin. That advice assumes human bandwidth is the constraint. When AI agents handle implementation, the constraint shifts. The bottleneck becomes judgment: what to build, what to kill, what to publish, what to fix.

One person can make judgment calls across five ventures. One person cannot write code across five ventures. The lab model works because the division of labor is clear: the human handles the small, high-leverage decisions. The agents handle the large, well-specified implementation work.

There's a portfolio benefit too. Not every product idea works. Durgan Field Guide is launched and live. Kid Expenses is in active development. Draft Crane is pre-launch. If we'd gone all-in on a single product and it hadn't found traction, we'd have nothing to show for the infrastructure investment. With five ventures sharing the same tooling, each new venture is cheaper to start, and the infrastructure compounds rather than depreciates.

## What Doesn't Work Yet

The model has real limitations.

**Judgment doesn't scale linearly.** Five ventures means five sets of product decisions, five backlogs to prioritize, five contexts to hold in your head. The infrastructure handles implementation scale, but the founder is still a single-threaded processor for strategic decisions. Some weeks, one venture gets attention and the others coast.

**Agent quality varies by task type.** Agents handle infrastructure, backend logic, and content formatting extremely well. Design judgment, copy tone, and novel architecture decisions still require heavy human involvement. The lab saves time on the tasks agents are good at, but it doesn't eliminate the tasks they're not.

**Content is a real commitment.** Publishing what we learn - the methodology, the costs, the failures - takes time that competes with building. The PRD for this site includes an explicit kill criterion: if we can't sustain one substantive article per month, archive the site rather than let it go stale. We haven't hit that threshold yet, but we're watching it.

## The Artifact: Venture Registry Pattern

If you're considering a similar structure, the venture registry is the simplest starting point. A JSON file mapping venture codes to their capabilities:

```json
{
  "code": "ke",
  "name": "Kid Expenses",
  "org": "venturecrane",
  "capabilities": ["has_api", "has_database"]
}
```

The MCP server reads this at startup. When an agent begins a session for `ke`, it knows which infrastructure to expect and which documentation to load. Adding a new venture means adding a JSON entry and creating its secrets path - not rebuilding the tooling.

The registry is intentionally simple. Ventures are just entries with codes and capability flags. No inheritance hierarchies, no plugin systems, no configuration DSL. The complexity lives in the shared infrastructure that reads the registry, not in the registry itself.
