---
title: 'How We Work'
updatedDate: 2026-02-14
---

Venture Crane runs on a documented, repeatable operating system. One person, AI agent teams, a shared codebase — and a set of operational patterns that make it work.

## The Model

The human handles judgment: what to build, what to kill, what to publish, what to fix. AI agents — Claude Code sessions running across a fleet of dev machines — handle implementation: writing code, running tests, opening pull requests, deploying.

Every product in the portfolio runs on shared infrastructure. Same framework choices (Astro, Next.js), same backend stack (Cloudflare Workers, D1), same CI/CD pipeline (GitHub Actions). When the infrastructure improves, every product benefits. See the [portfolio](/portfolio/) for the current roster.

This shared model enforces discipline. Agent hours are finite. Products that attract users earn more of them. Products that don't — after a meaningful evaluation window with real distribution — get shut down. The portfolio stays lean because the operating model demands it: one person can't afford to maintain software nobody uses.

## Session Lifecycle

Every agent session follows the same structure, whether it's a thirty-minute bugfix or a multi-hour feature build.

**Orientation.** Each session begins by reading a structured handoff record from the previous session. No cold starts. The agent knows what shipped, what's in progress, and what's blocked before writing a line of code.

**Issue-driven execution.** Work is organized around GitHub issues with priority labels. Agents pick up the highest-priority ready issue, work it to completion, and open a pull request. No free-form exploration.

**Automated quality gates.** Every push runs through pre-push hooks — TypeScript compilation, ESLint, Prettier formatting, and the test suite. CI runs the same checks independently. QA grades on each issue match the verification method to the type of work: a data migration gets different scrutiny than a copy change.

**Handoff.** Before ending, the agent writes a structured handoff record: what was completed, what's still open, what the next session should pick up. The cycle resets.

## See It in Practice

The methodology produces the work. These articles show it in action:

- [Building a Dark-Theme Design System with Tailwind v4](/articles/building-dark-theme-design-system/) — A design system built through this workflow: agent implementation, human design judgment, automated quality enforcement.

## Founder

Scott Durgan spent 25 years building enterprise software — large-scale systems, distributed teams, the full lifecycle from architecture through production operations. Along the way, he noticed the same pattern: most of the time spent shipping software wasn't spent on the hard problems. It was spent on coordination, context-switching, and rediscovering what someone already knew. AI agents don't eliminate the hard problems, but they eliminate the coordination tax. Venture Crane is the infrastructure that makes that operational — one person setting direction, agent teams handling implementation, and a publishing practice that documents what actually works.

[X](https://x.com/venturecrane) · [GitHub](https://github.com/venturecrane)
