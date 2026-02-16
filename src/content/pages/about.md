---
title: 'The System'
updatedDate: 2026-02-16
---

AI agents are productive when they operate inside constraints. Without structure, they churn, hallucinate, and waste money. With the right operating system, one person can run a venture studio on them.

---

## What We Believe

**Agents are infrastructure, not magic.** They are unreliable by default. Reliability comes from session protocols, quality gates, and kill discipline - not from better prompts or bigger models.

**Sessions are the unit of work.** Not sprints, not stories, not tickets. A bounded session with a defined start, scope, and end. Everything in this system flows from that unit.

**Context is the hardest problem.** Every session starts cold. The system that delivers the right context - not all context, the right context - determines whether an agent produces useful work or expensive noise.

**Agents need external enforcement, not better judgment.** Experienced engineers resist shortcuts instinctively. Agents don't. Quality has to be structural - enforced by hooks, gates, and automated checks that run whether the agent remembers them or not.

---

## The Primitives

Six named concepts make the system work.

**Sessions.** A session is a bounded unit of agent work. It begins with orientation (reading the previous handoff), executes against a single issue, and ends with a structured handoff. Sessions can crash, get interrupted, or span machines. The protocol handles all of it. See [Sessions as First-Class Citizens](/articles/sessions-heartbeats-handoffs/).

**Handoffs.** A handoff is a structured record written at the end of every session: what shipped, what's in progress, what's blocked, what the next session should pick up. Handoffs are what give sessions memory. Without them, every session is a cold start. The handoff protocol is part of the [session lifecycle](/articles/sessions-heartbeats-handoffs/).

**Context.** Context is the information an agent needs to do useful work. It includes handoff state, the work queue, enterprise knowledge, and operational documentation. The system delivers context at session startup through an MCP server that lazy-loads only what's needed. See [Agent Context Management](/articles/agent-context-management-system/) and [96% Token Reduction](/articles/lazy-loading-agent-context/).

**Tools.** Tools are the interfaces agents use to interact with external systems - GitHub issues, CI pipelines, documentation stores, deployment targets. Tools are typed, validated, and delivered through MCP. See [Building an MCP Server](/articles/building-mcp-server/).

**Environments.** Every agent runs on a physical machine in a managed fleet. Environments are bootstrapped identically: same CLI tools, same SSH mesh, same secrets injection. Adding a machine takes minutes. See [Fleet Management for One Person](/articles/fleet-management-solo/).

**Secrets.** Secrets are injected at agent launch time from Infisical - never stored in .env files, never hardcoded. A CLI launcher scans the repo, matches it to a venture, and injects the right credentials. The pattern matters more than the tool: secrets exist only in memory, only for the duration of the session, and only for the venture that needs them. See [Secrets Injection at Agent Launch Time](/articles/secrets-injection-agent-launch/).

---

## Session Lifecycle

Every agent session follows the same structure, whether it's a thirty-minute bugfix or a multi-hour feature build.

**Orientation.** Each session begins by reading a structured handoff record from the previous session. No cold starts. The agent knows what shipped, what's in progress, and what's blocked before writing a line of code.

**Issue-driven execution.** Work is organized around GitHub issues with priority labels. Agents pick up the highest-priority ready issue, work it to completion, and open a pull request. No free-form exploration.

**Automated quality gates.** Every push runs through pre-push hooks - TypeScript compilation, ESLint, Prettier formatting, and the test suite. CI runs the same checks independently. QA grades on each issue match the verification method to the type of work: a data migration gets different scrutiny than a copy change.

**Handoff.** Before ending, the agent writes a structured handoff record: what was completed, what's still open, what the next session should pick up. The cycle resets.

---

## See It in Practice

If you only read three articles, read these.

<!-- Curated list — review when new methodology articles publish -->

- [Kill Discipline for AI Agent Teams](/articles/kill-discipline-ai-agents/) - Five mandatory stop rules that force agents to escalate instead of spiral. The most important operational pattern we've found.
- [Multi-Agent Team Protocols Without Chaos](/articles/multi-agent-team-protocols/) - How agents and humans coordinate without stepping on each other.
- [Agent Context Management System](/articles/agent-context-management-system/) - The centralized system that gives every session immediate access to handoff state, enterprise knowledge, and the work queue.

---

## Founder

I've been a cook, a silversmith, a woodworker, a video producer, a product manager, and a software developer. Every time I change materials, I do the same thing first: set up the station, build the jigs, get the process right.

When I started building products again, I built the shop first. A small fleet of Macs on a Tailscale mesh, Cloudflare Workers on the backend, Vercel on the front. Agents that start each session by reading what happened in the last one. Every issue gets a QA grade. Every venture has kill criteria. If the numbers don't hit, it dies.

That's the setup. Now it's time to ship. Or, you know, go down trying.
