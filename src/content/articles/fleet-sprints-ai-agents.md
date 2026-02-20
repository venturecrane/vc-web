---
title: 'What Breaks When You Sprint with 10 AI Agents'
date: 2026-02-20
description: 'Wave-based sprint execution across a fleet of machines works until local state drifts from remote. Here is what we learned.'
author: 'Venture Crane'
tags: ['agent-architecture', 'process']
draft: false
---

Spawning one AI coding agent on a feature branch is straightforward. Spawning ten across four machines, organized into dependency waves, with each agent working an isolated worktree - that is where the failure modes get interesting.

We built a sprint orchestrator that takes a set of GitHub issues, resolves their dependency graph, and executes them in parallel waves using Claude Code agents on git worktrees. A recent feature build was its largest test: 36 PRs across four waves, four machines, three hours. Most of it went well. The failures revealed specific problems worth documenting.

---

## The Orchestration Model

The sprint skill is a prompt-driven orchestrator. It does not manage long-running processes or maintain state between waves. Each invocation is stateless:

1. Fetch the assigned GitHub issues
2. Parse dependency annotations (`depends on #N`, `blocked by #N`)
3. Build a wave plan - issues with no unresolved dependencies go first, up to the machine's concurrency limit
4. Create one git worktree per issue, each on a fresh branch from main
5. Spawn all agents in a single message for true parallelism
6. Wait for completion, collect results, update labels

Each agent receives a self-contained prompt: the issue body, the worktree path, the branch name, and the project's verification command. The agent implements, runs verification, commits, pushes, and opens a PR. If it fails verification three times, it stops and reports failure instead of shipping broken code.

The orchestrator only executes one wave per invocation. After Wave 1's PRs are reviewed and merged, you run the sprint skill again with the remaining issues. Wave 2 branches from the updated main. This eliminates inter-wave state management entirely - there is no state to manage.

Machine concurrency is detected at runtime from the hostname. Stronger machines run three agents. Lighter ones run two. The fleet ran all four machines simultaneously during peak waves, putting up to ten agents in flight at once.

## What Worked

**Worktree isolation is the right abstraction.** Each agent gets its own copy of the codebase at a specific commit. No shared mutable state. No merge conflicts during implementation. Two agents can edit the same file in their respective worktrees without interference - conflicts only surface at PR review time, where they belong.

**Single-issue agents stay focused.** Each agent gets one issue, one branch, one PR. No scope creep, no "while I'm here" refactoring. The prompt explicitly constrains: "NEVER modify files that are not relevant to your issue." This produces small, reviewable PRs. Thirty-six PRs sounds like a lot, but each one is a single coherent change.

**Wave boundaries are natural review gates.** Between waves, the human reviews all PRs from the previous wave, resolves any conflicts, and merges. This catches integration issues before the next wave builds on top of them. It also means the human stays in the loop without becoming a bottleneck during implementation.

**Failure is contained.** When one agent fails - bad implementation, test failures, timeout - it reports failure and the orchestrator handles it. Other agents in the same wave are unaffected. The orchestrator offers a retry (fresh worktree, same prompt) or a skip. One retry max per issue to prevent infinite loops.

## What Broke

Wave 4 produced two PRs with conflicts in every file. Not subtle merge conflicts - every file was different from what was on main.

The root cause: two machines had stale local main branches. Between Wave 3 and Wave 4, the Wave 3 PRs were merged on GitHub. The machine running the orchestrator pulled main. The other two machines did not. When the sprint skill created worktrees on those machines, `git worktree add` branched from their local HEAD - which was three waves behind remote.

The agents had no way to detect this. Their worktrees were internally consistent. Tests passed. Code compiled. The PRs opened successfully. But the diffs showed every change from the previous three waves as modifications, because the base commit was ancient.

We closed both PRs and reimplemented the work on a machine with current main. Two agents' worth of correct implementation, discarded because of a missing `git pull`.

A separate machine hit intermittent shell failures - commands returning empty output or timing out. The agents hit their retry limits and reported failure. We reassigned those issues to healthy machines. The root cause was never identified, which is its own lesson about fleet reliability.

## The Fix

The sprint skill had one implicit assumption: "local main is current." That is true if someone recently pulled. It is false after merging PRs on GitHub between waves, which is exactly what happens in every multi-wave sprint.

The fix is a sync gate at the top of the worktree setup phase:

```bash
git fetch origin main
```

Compare `git rev-parse main` against `git rev-parse origin/main`:

- **Match**: Proceed. Local is current.
- **Local behind**: Fast-forward with `git merge --ff-only origin/main`. If the fast-forward fails (local has diverged), stop with an error. Diverged main requires human judgment.
- **Local ahead**: Warn but proceed. The operator may have intentional local commits.

Three lines of logic that prevent an entire wave of wasted work.

## Lessons

**State management happens between waves, not during them.** During a wave, worktree isolation handles everything. Between waves, the fleet's local state must be synchronized with remote before the next wave launches. The orchestrator now enforces this, but the broader principle applies to any multi-machine agent workflow: the dangerous moment is the transition, not the execution.

**Agent correctness is local; integration correctness is global.** Each agent can produce a perfect implementation against the code it can see. That means nothing if the code it can see is stale. Verification commands (lint, typecheck, test) validate internal consistency. They cannot validate that the agent is working against the right baseline. That check must happen before the agent starts.

**Machine health is not guaranteed.** A machine that worked yesterday can fail today with no configuration change. Shell timeouts, disk issues, network flakiness - intermittent failures that agents can't diagnose or fix. Pre-flight health checks before spawning agents would catch machines having a bad day before they waste a wave slot. We have not built this yet, but the need is clear.

**Throughput is gated by the human, not the agents.** Ten agents in parallel can produce ten PRs in 15 minutes. Reviewing, merging, and sequencing those PRs takes longer than producing them. The effective throughput of this sprint was roughly 10 issues per session, with agent time measured in minutes and human time measured in hours. Optimizing agent speed further would not improve total throughput. Optimizing the review pipeline would.
