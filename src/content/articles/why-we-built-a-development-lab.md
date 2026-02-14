---
title: 'Why Venture Crane Is a Development Lab, Not a Product Company'
date: 2026-02-14
description: 'How shared infrastructure across 5 ventures reduces coordination tax and makes the multi-product model viable.'
author: 'Venture Crane'
tags: ['methodology', 'strategy', 'operations']
sources: '[crane-console](https://github.com/venturecrane/crane-console) monorepo (venture registry, MCP server, CLI launcher, infrastructure scripts), [vc-web](https://github.com/venturecrane/vc-web) site source. Some sources reference private repositories.'
draft: true
---

Venture Crane is a development lab that runs five software ventures on shared infrastructure. The infrastructure - session management, context injection, secrets management, CI/CD, fleet networking - is built once and used by every venture. This article describes what that infrastructure is, how the portfolio model works, and where it falls short.

---

## The Structure

Venture Crane consists of a parent LLC (SMD Ventures) and five ventures at different stages:

| Venture            | Code | Status     | Stack                         |
| ------------------ | ---- | ---------- | ----------------------------- |
| Venture Crane      | vc   | Active     | Cloudflare Workers, D1, Astro |
| Kid Expenses       | ke   | Active     | Cloudflare Workers, D1        |
| Silicon Crane      | sc   | Active     | Cloudflare Workers, D1        |
| Durgan Field Guide | dfg  | Active     | Cloudflare Workers, D1        |
| Design Crane       | dc   | Pre-launch | D1                            |

All five share a common backend stack (Cloudflare Workers + D1), a common secrets manager (Infisical), a common CI/CD pipeline (GitHub Actions), and a common fleet of development machines connected via Tailscale.

The shared infrastructure lives in a single monorepo: [crane-console](https://github.com/venturecrane/crane-console).

---

## What the Shared Infrastructure Does

### Agent Context Management

AI coding agents start every session cold. They don't know what happened yesterday, what another agent is working on, or what the project's business context is. Venture Crane solves this with a context management system that gives every agent session immediate access to:

- **Session continuity** - structured handoffs from the previous session, automatically loaded at start
- **Parallel awareness** - which other agents are active and what they're working on
- **Enterprise knowledge** - business context, product requirements, strategy documents stored in D1
- **Documentation** - team workflows, API specs, coding standards, self-healing when docs go stale

The system consists of three components:

1. **crane-context** - a Cloudflare Worker that stores sessions, handoffs, knowledge notes, and documentation in D1
2. **crane-mcp** - a local MCP server (Node.js, TypeScript) that connects AI CLI tools to the context API, generates documentation from source files, and renders structured output
3. **A CLI launcher** - a single command (`crane ke`, `crane sc`, etc.) that fetches secrets from Infisical, configures the MCP server, and spawns the agent CLI in the correct repo

One command starts a fully configured agent session for any venture. No manual environment setup, no secrets pasting, no MCP configuration.

### Webhook Processing

crane-classifier processes incoming GitHub webhooks for all ventures. When an issue is created, it auto-assigns priority labels and QA grades based on content analysis. Work enters the queue pre-sorted.

### Fleet Management

Five macOS development machines run Tailscale for mesh networking. An SSH mesh script establishes bidirectional SSH between all machines with a single run. tmux sessions persist agent work across disconnections. Mobile access works through Blink Shell + Mosh, meaning an iPad can connect to any machine's running agent session from anywhere.

---

## How the Portfolio Model Works

The venture registry in `config/ventures.json` maps each venture to its capabilities:

```json
{
  "ventures": [
    {
      "code": "ke",
      "name": "Kid Expenses",
      "org": "venturecrane",
      "capabilities": ["has_api", "has_database"]
    }
  ]
}
```

The MCP server reads this at startup. When an agent begins a session for `ke`, it knows which documentation to load, which schemas to audit, and which infrastructure to expect. Adding a new venture means adding a JSON entry, creating its secrets path in Infisical, and creating its GitHub repos. The shared tooling picks it up automatically.

The capabilities array drives conditional behavior. Documentation self-healing only generates API docs for ventures with `has_api`. Schema audits only run for ventures with `has_database`. A venture with no capabilities still gets session management, handoffs, and enterprise context - it just skips the infrastructure-specific automation.

### What Improves Once, Improves Everywhere

This is the non-obvious advantage of the model. When the CI pipeline gets a security scanning step, all five ventures get it. When the MCP server adds a new tool (like the doc audit self-healer), every venture benefits on the next session. When the CLI launcher learns to support Gemini CLI alongside Claude Code, every venture can use either agent.

The infrastructure investment compounds rather than depreciates. Each new venture added to the registry is cheaper to operate than the last because the tooling already exists.

### The Economics

A solo founder can make judgment calls across five ventures. A solo founder cannot write code across five ventures. The development lab model works because AI agents handle the implementation volume while the human handles the strategic decisions: what to build, what to kill, what to publish, what to fix.

There is also a portfolio diversification effect. Not every product idea works. With five ventures sharing infrastructure, a single failure doesn't waste the infrastructure investment. The tooling keeps serving the ventures that succeed.

---

## Current Limitations

These are real constraints, drawn from operational experience and open issues.

**Judgment doesn't scale linearly.** Five ventures means five sets of product decisions, five backlogs to prioritize, five business contexts to maintain. The infrastructure handles implementation scale, but strategic attention is a fixed resource. Some weeks, one venture gets focus and the others coast.

**Agent quality varies by task type.** Agents handle infrastructure, backend logic, and structured content well. Design judgment, copy tone, and novel architecture decisions require heavy human involvement. The lab saves time on tasks agents are good at but doesn't eliminate the tasks they're not.

**Context window pressure.** The start-of-day initialization measured 298K characters in one session. There is currently no truncation or budget management - the full context is injected into the agent's working memory. This competes for space with the actual work. Metadata-only document delivery is partially implemented but not yet the default.

**Single-environment deployment.** All ventures run in a single Cloudflare environment. There is no staging/production separation for the context API. A bad deployment affects all active agent sessions across all ventures simultaneously. Environment separation is designed (ADR 026) but not yet deployed.

**Content commitment risk.** Publishing operational details - methodology, costs, failures - takes time that competes with building. The site's PRD includes a kill criterion: if output drops below one substantive article per month, archive rather than let it go stale.

---

## The Venture Registry

The full registry, from the actual `config/ventures.json` in crane-console:

```json
{
  "sharedSecrets": {
    "source": "/vc",
    "keys": ["CRANE_CONTEXT_KEY", "CRANE_ADMIN_KEY"]
  },
  "ventures": [
    {
      "code": "vc",
      "name": "Venture Crane",
      "org": "venturecrane",
      "capabilities": ["has_api", "has_database"]
    },
    {
      "code": "sc",
      "name": "Silicon Crane",
      "org": "venturecrane",
      "capabilities": ["has_api", "has_database"]
    },
    {
      "code": "dfg",
      "name": "Durgan Field Guide",
      "org": "venturecrane",
      "capabilities": ["has_api", "has_database"]
    },
    {
      "code": "ke",
      "name": "Kid Expenses",
      "org": "venturecrane",
      "capabilities": ["has_api", "has_database"]
    },
    { "code": "smd", "name": "SMD Ventures", "org": "venturecrane", "capabilities": [] },
    {
      "code": "dc",
      "name": "Design Crane",
      "org": "venturecrane",
      "capabilities": ["has_database"]
    }
  ]
}
```

The `sharedSecrets` block was added in February 2026. It tells the CLI launcher to copy `CRANE_CONTEXT_KEY` and `CRANE_ADMIN_KEY` from the `/vc` Infisical path into every venture's environment. Before this, each venture needed its own copy of the shared secrets - a maintenance burden that scaled linearly with venture count.

Six entries, not five: SMD Ventures is the parent LLC. It has no API or database capabilities but participates in session management and enterprise context. Design Crane has `has_database` but not `has_api` - it uses D1 for storage but doesn't expose an HTTP API yet.
