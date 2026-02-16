---
title: 'How We Work'
updatedDate: 2026-02-14
---

Venture Crane runs on a documented, repeatable operating system. One person, AI agent teams, a shared codebase - and a set of operational patterns that make it work.

## The Model

The human handles judgment: what to build, what to kill, what to publish, what to fix. AI agents - Claude Code sessions running across a fleet of dev machines - handle implementation: writing code, running tests, opening pull requests, deploying.

Every product in the portfolio runs on shared infrastructure. Same framework choices (Astro, Next.js), same backend stack (Cloudflare Workers, D1), same CI/CD pipeline (GitHub Actions). When the infrastructure improves, every product benefits. This shared model enforces discipline. Agent hours are finite. Products that attract users earn more of them. Products that don't - after a meaningful evaluation window with real distribution - get shut down. The portfolio stays lean because the operating model demands it: one person can't afford to maintain software nobody uses.

## Session Lifecycle

Every agent session follows the same structure, whether it's a thirty-minute bugfix or a multi-hour feature build.

**Orientation.** Each session begins by reading a structured handoff record from the previous session. No cold starts. The agent knows what shipped, what's in progress, and what's blocked before writing a line of code.

**Issue-driven execution.** Work is organized around GitHub issues with priority labels. Agents pick up the highest-priority ready issue, work it to completion, and open a pull request. No free-form exploration.

**Automated quality gates.** Every push runs through pre-push hooks - TypeScript compilation, ESLint, Prettier formatting, and the test suite. CI runs the same checks independently. QA grades on each issue match the verification method to the type of work: a data migration gets different scrutiny than a copy change.

**Handoff.** Before ending, the agent writes a structured handoff record: what was completed, what's still open, what the next session should pick up. The cycle resets.

## See It in Practice

<!-- Curated list — review when new methodology articles publish -->

- [Kill Discipline for AI Agent Teams](/articles/kill-discipline-ai-agents/) — How we prevent agents from churning on unsolvable problems.
- [Multi-Agent Team Protocols Without Chaos](/articles/multi-agent-team-protocols/) — How agents and humans coordinate without stepping on each other.
- [Sessions as First-Class Citizens](/articles/sessions-heartbeats-handoffs/) — How sessions start, end, and recover across machines.

## Founder

I've been a cook, a silversmith, a woodworker, a video producer, a product manager, and a software developer. Every time I change materials, I do the same thing first: set up the station, build the jigs, get the process right.

When I started building products again, I built the shop first. A small fleet of Macs on a Tailscale mesh, Cloudflare Workers on the backend, Vercel on the front. Agents that start each session by reading what happened in the last one. Every issue gets a QA grade. Every venture has kill criteria. If the numbers don't hit, it dies.

That's the setup. Now it's time to ship. Or, you know, go down trying.
