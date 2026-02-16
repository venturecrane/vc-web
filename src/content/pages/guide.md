---
title: 'Start Here'
updatedDate: 2026-02-16
---

Curated reading paths through everything we've published. Each article is a field note from running AI agent teams in production - real costs, real failures, real infrastructure decisions.

## Where should I start?

**If you're a solo founder running agents** and want to know what it actually costs and how to keep them from wasting money, start with [what it costs](/articles/what-ai-agents-actually-cost/) and [kill discipline](/articles/kill-discipline-ai-agents/).

**If you're a team adopting AI coding tools** and want protocols that prevent chaos, start with [multi-agent team protocols](/articles/multi-agent-team-protocols/) and [sessions](/articles/sessions-heartbeats-handoffs/).

**If you're just exploring**, read [The System](/the-system/) first for the operating model, then come back here for the field notes.

---

## What It Costs

The first question everyone asks. Here is the full breakdown - every line item, no rounding, no "contact us for pricing."

- [What Running Multiple Ventures with AI Agents Actually Costs](/articles/what-ai-agents-actually-cost/) - The complete monthly bill: infrastructure, AI subscriptions, hardware amortization, domains. About $450/month for several active projects.

- [Why We Built a Development Lab Instead of a Product](/articles/why-development-lab/) - Why shared infrastructure across ventures changes the math for a solo founder, and when it makes sense to build the shop before the product.

---

## Keeping Agents Reliable

AI agents are optimistic by default. They will churn on unsolvable problems for hours without escalating. These articles cover the operational patterns that prevent that.

- [Kill Discipline for AI Agent Teams](/articles/kill-discipline-ai-agents/) - Five mandatory stop rules that force agents to escalate instead of spiral. The most important operational pattern we've found.

- [Multi-Agent Team Protocols Without Chaos](/articles/multi-agent-team-protocols/) - How to coordinate dev agents, PM agents, an advisor, and a human captain without them stepping on each other. Namespaced labels, QA grading, explicit role boundaries.

- [Multi-Model Code Review - Why One AI Isn't Enough](/articles/multi-model-code-review/) - What happens when you send the same code through multiple AI models with different strengths. Each model catches things the others miss.

- [Sessions as First-Class Citizens](/articles/sessions-heartbeats-handoffs/) - How to give agent sessions the same reliability guarantees as distributed systems: heartbeats, idempotent handoffs, crash recovery.

- [From Monolith to Microworker](/articles/decommissioning-crane-relay/) - Kill discipline applied to infrastructure. We deleted a 3,234-line worker, its database, and its storage bucket. Nothing noticed it was gone.

---

## Context Management

The hardest problem in multi-agent development: every session starts cold. These articles cover the system that gives agents memory across sessions and machines.

- [How We Built an Agent Context Management System](/articles/agent-context-management-system/) - How every agent session gets immediate access to handoff state, enterprise knowledge, the work queue, and operational docs - on any machine.

- [96% Token Reduction - Lazy-Loading Agent Context](/articles/lazy-loading-agent-context/) - Session startup was consuming 45,000-71,000 tokens before useful work. How we cut it to 3,000 by switching to an index-and-fetch pattern.

- [Building an MCP Server for Workflow Orchestration](/articles/building-mcp-server/) - How to bridge AI coding CLIs to a custom backend API with typed, validated tools. The transition from fragile bash scripts to a real protocol.

- [Documentation as Operational Infrastructure](/articles/documentation-operational-infra/) - Why stale docs are actively dangerous when your developers follow instructions literally, and how to make documentation self-healing.

---

## Infrastructure

The physical and logical infrastructure that makes multi-agent development work at the solo-founder scale.

- [Fleet Management for One Person](/articles/fleet-management-solo/) - How to manage a distributed dev fleet with Tailscale, idempotent bootstrap scripts, and SSH mesh networking. Adding a machine takes minutes.

- [Secrets Injection at Agent Launch Time](/articles/secrets-injection-agent-launch/) - One command, right secrets, no files on disk. A CLI launcher that scans the repo and injects credentials from Infisical at launch time.

- [One Monorepo, Multiple Ventures](/articles/monorepo-registry-driven/) - How a JSON venture registry with capability flags lets a single monorepo serve multiple products with shared tooling and enforced boundaries.

- [Staging Environments for AI Agents](/articles/staging-environments-ai-agents/) - When your "developers" execute `wrangler deploy` literally, you need a gate between development and production.

- [Building a Dark-Theme Design System with Tailwind v4](/articles/building-dark-theme-design-system/) - The technical decisions behind the site you're reading now. CSS custom properties, Tailwind v4 theme config, dark-first design.

---

## Ship Log and RSS

Short-form field notes published after each working session. Unpolished, timestamped, occasionally surprising. [Browse the full ship log](/log/).

New articles publish roughly weekly. The ship log updates more frequently. Subscribe via [RSS feed](/feed.xml) or [articles-only RSS](/feed/articles.xml).

---

These articles document how we work. For the principles behind it, read [The System](/the-system/). For the problems we haven't solved yet, see [Open Problems](/open-problems/).
