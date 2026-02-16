---
title: 'AI Agent Operations Guide'
updatedDate: 2026-02-15
---

Field notes from running multi-agent AI development teams in production. These articles document real infrastructure decisions, real costs, real failures, and real post-mortems from operating a solo-founder venture studio with AI coding agents.

Start anywhere that matches what you are working on. Each section builds on the others, but they stand alone.

---

## What It Costs

The first question everyone asks. Here is the full breakdown - every line item, no rounding, no "contact us for pricing."

- [What Running Multiple Ventures with AI Agents Actually Costs](/articles/what-ai-agents-actually-cost/) - The complete monthly bill for running several active projects with AI agents across a fleet of development machines. Total: about $450/month. Covers infrastructure (Cloudflare free tier), secrets management, networking, AI subscriptions, hardware amortization, and domains.

- [Why We Built a Development Lab Instead of a Product](/articles/why-development-lab/) - The strategic decision behind shared infrastructure. Instead of going all-in on a single product, we built a development lab first - and why the coordination tax makes that math work for a solo founder.

---

## Keeping Agents Reliable

AI agents are optimistic by default. They will churn on unsolvable problems for hours without escalating. These articles cover the operational patterns that prevent that.

- [Kill Discipline for AI Agent Teams](/articles/kill-discipline-ai-agents/) - Five mandatory stop rules that force agents to escalate instead of spiral. Born from a post-mortem where an agent churned for 10+ hours on symptoms instead of flagging the actual blocker.

- [Multi-Agent Team Protocols Without Chaos](/articles/multi-agent-team-protocols/) - How we coordinate dev agents, PM agents, an advisor, and a human captain using namespaced labels, QA grading, and explicit role boundaries. The default state of multiple agents on the same codebase is chaos. This is how we prevent it.

- [Multi-Model Code Review - Why One AI Isn't Enough](/articles/multi-model-code-review/) - Why sending code through multiple AI models with different strengths produces higher-confidence findings than any single model. Each model reviews through a different lens: architecture, security patterns, cross-file consistency.

- [Sessions as First-Class Citizens](/articles/sessions-heartbeats-handoffs/) - Heartbeats, idempotent handoffs, and crash recovery for AI agent sessions. The same reliability patterns used in distributed systems, applied to agents that can crash, get interrupted, or lose their laptop mid-task.

---

## Context Management

The hardest problem in multi-agent development: every session starts cold. These articles cover the system that gives agents memory across sessions and machines.

- [How We Built an Agent Context Management System](/articles/agent-context-management-system/) - The centralized system that gives every agent session - on any machine - immediate access to session continuity, parallel awareness, enterprise knowledge, operational documentation, and work queue visibility.

- [96% Token Reduction - Lazy-Loading Agent Context](/articles/lazy-loading-agent-context/) - Our session startup was consuming 45,000-71,000 tokens before the agent did any useful work. We cut it to 3,000 tokens by switching from eager document loading to an index-and-fetch pattern. No backend changes required.

- [Building an MCP Server for Workflow Orchestration](/articles/building-mcp-server/) - A 5,200-word walkthrough of building the MCP server that bridges AI coding CLIs to a custom backend API. Covers tool design, fleet deployment, and the transition from fragile bash scripts to a typed, validated protocol.

- [Documentation as Operational Infrastructure](/articles/documentation-operational-infra/) - Why stale documentation is actively harmful for AI agent teams (they follow outdated instructions literally), and how we treat docs as self-healing infrastructure with version tracking and automatic delivery.

---

## Infrastructure

The physical and logical infrastructure that makes multi-agent development work at the solo-founder scale.

- [Fleet Management for One Person](/articles/fleet-management-solo/) - How one person manages a distributed dev fleet with Tailscale, idempotent bootstrap scripts, SSH mesh networking, and macOS hardening. Every machine gets identical tooling. Adding a new machine takes minutes, not hours.

- [Secrets Injection at Agent Launch Time](/articles/secrets-injection-agent-launch/) - A CLI launcher that scans repos, matches them to projects, and injects the right secrets from Infisical without .env files or hardcoded credentials. One command, right secrets, no files on disk.

- [One Monorepo, Multiple Ventures](/articles/monorepo-registry-driven/) - How a JSON venture registry with capability flags lets a single monorepo serve multiple products. Shared tooling with product boundaries the automation respects automatically.

- [Staging Environments for AI Agents](/articles/staging-environments-ai-agents/) - Why agents make the case for staging environments stronger, not weaker. When your "developers" execute `wrangler deploy` literally, you need a gate between development and production.

---

## Architecture Decisions

What we built, what we killed, and what we learned from both.

- [From Monolith to Microworker](/articles/decommissioning-crane-relay/) - We deleted a 3,234-line Cloudflare Worker, its database, and its storage bucket. 19 files, 6,231 lines removed. Nothing noticed it was gone. A case study in scope creep and the courage to delete.

- [Building a Dark-Theme Design System with Tailwind v4](/articles/building-dark-theme-design-system/) - How we built a dark-first design system using CSS custom properties and Tailwind v4 theme configuration. The technical decisions behind the site you are reading right now.

---

## Build Log

Short-form field notes published after each working session. Unpolished, timestamped, occasionally surprising. The kind of operational detail that does not make it into articles but tells you what actually happened.

[Browse the full build log &rarr;](/log/)

---

## Stay Current

New articles publish roughly weekly. The build log updates more frequently.

- [RSS feed](/feed.xml) for feed readers
- [Articles-only RSS](/feed/articles.xml) if you want to skip build logs
