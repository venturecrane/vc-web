---
title: 'Start Here'
updatedDate: 2026-02-16
---

Field notes from running multi-agent AI development teams in production. These articles document real infrastructure decisions, real costs, real failures, and real post-mortems from operating a solo-founder venture studio with AI coding agents.

### Where should I start?

**If you're a solo founder running agents** and want to know what it actually costs and how to keep them from wasting money, start with the cost breakdown and kill discipline.

**If you're a team adopting AI coding tools** and want protocols that prevent chaos, start with multi-agent team protocols and sessions.

**If you're just exploring**, read [The System](/the-system/) first for the operating model, then come back here for the field notes.

---

## What It Costs

The first question everyone asks. Here is the full breakdown - every line item, no rounding, no "contact us for pricing."

- [What Running Multiple Ventures with AI Agents Actually Costs](/articles/what-ai-agents-actually-cost/) - The complete monthly bill for running several active projects with AI agents across a fleet of development machines. Total: about $450/month.

- [Why We Built a Development Lab Instead of a Product](/articles/why-development-lab/) - The strategic decision behind shared infrastructure. Instead of going all-in on a single product, we built a development lab first.

---

## Keeping Agents Reliable

AI agents are optimistic by default. They will churn on unsolvable problems for hours without escalating. These articles cover the operational patterns that prevent that.

- [Kill Discipline for AI Agent Teams](/articles/kill-discipline-ai-agents/) - Five mandatory stop rules that force agents to escalate instead of spiral. The most important operational pattern we've found.

- [Multi-Agent Team Protocols Without Chaos](/articles/multi-agent-team-protocols/) - How we coordinate dev agents, PM agents, an advisor, and a human captain using namespaced labels, QA grading, and explicit role boundaries.

- [Multi-Model Code Review - Why One AI Isn't Enough](/articles/multi-model-code-review/) - Why sending code through multiple AI models with different strengths produces higher-confidence findings than any single model.

- [Sessions as First-Class Citizens](/articles/sessions-heartbeats-handoffs/) - Heartbeats, idempotent handoffs, and crash recovery for AI agent sessions. The same reliability patterns used in distributed systems, applied to agents.

---

## Context Management

The hardest problem in multi-agent development: every session starts cold. These articles cover the system that gives agents memory across sessions and machines.

- [How We Built an Agent Context Management System](/articles/agent-context-management-system/) - The centralized system that gives every agent session immediate access to session continuity, parallel awareness, enterprise knowledge, and work queue visibility.

- [96% Token Reduction - Lazy-Loading Agent Context](/articles/lazy-loading-agent-context/) - Our session startup was consuming 45,000-71,000 tokens before useful work. We cut it to 3,000 tokens by switching to an index-and-fetch pattern.

- [Building an MCP Server for Workflow Orchestration](/articles/building-mcp-server/) - A walkthrough of building the MCP server that bridges AI coding CLIs to a custom backend API. Covers tool design, fleet deployment, and the transition from bash scripts to a typed protocol.

- [Documentation as Operational Infrastructure](/articles/documentation-operational-infra/) - Why stale documentation is actively harmful for AI agent teams and how we treat docs as self-healing infrastructure.

---

## Infrastructure

The physical and logical infrastructure that makes multi-agent development work at the solo-founder scale.

- [Fleet Management for One Person](/articles/fleet-management-solo/) - How one person manages a distributed dev fleet with Tailscale, idempotent bootstrap scripts, SSH mesh networking, and macOS hardening.

- [Secrets Injection at Agent Launch Time](/articles/secrets-injection-agent-launch/) - A CLI launcher that scans repos, matches them to projects, and injects the right secrets from Infisical. One command, right secrets, no files on disk.

- [One Monorepo, Multiple Ventures](/articles/monorepo-registry-driven/) - How a JSON venture registry with capability flags lets a single monorepo serve multiple products.

- [Staging Environments for AI Agents](/articles/staging-environments-ai-agents/) - Why agents make the case for staging environments stronger, not weaker.

---

## Architecture Decisions

What we built, what we killed, and what we learned from both.

- [From Monolith to Microworker](/articles/decommissioning-crane-relay/) - We deleted a 3,234-line Cloudflare Worker, its database, and its storage bucket. 19 files, 6,231 lines removed. A case study in scope creep and the courage to delete.

- [Building a Dark-Theme Design System with Tailwind v4](/articles/building-dark-theme-design-system/) - How we built a dark-first design system using CSS custom properties and Tailwind v4 theme configuration.

---

## Ship Log

Short-form field notes published after each working session. Unpolished, timestamped, occasionally surprising. The kind of operational detail that does not make it into articles but tells you what actually happened.

[Browse the full ship log &rarr;](/log/)

---

## Stay Current

New articles publish roughly weekly. The ship log updates more frequently.

- [RSS feed](/feed.xml) for feed readers
- [Articles-only RSS](/feed/articles.xml) if you want to skip ship logs
