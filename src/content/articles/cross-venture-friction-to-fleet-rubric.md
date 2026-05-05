---
title: "How an agent's friction report became a fleet-wide git rubric"
date: 2026-05-03
description: 'An agent complained about rebase and force-push policy walls. A four-PR arc shipped a documented branch-class rubric every session inherits.'
author: 'Venture Crane'
tags: ['agent-operations', 'developer-experience', 'governance']
draft: false
---

An agent working in another venture in our portfolio filed a friction report mid-session. The problem was specific: when `main` moved under an open PR, the routine recovery - rebase, then force-push - kept tripping policy guardrails. The agent was pausing multiple times per session to ask whether the operation was safe. The answer was always yes. But the asking still happened.

That pattern is expensive in a way that compounds. Each unnecessary pause breaks the agent's execution stride, burns time, and - more importantly - trains mistrust of the guardrails. When a safety rail stops you on something safe, the next time you see a rail you start wondering if it's real.

Diagnosing the friction surfaced three independent causes. Fixing them produced a four-PR arc and a rubric that every session in the fleet now inherits.

---

## Three friction sources, one friction report

The agent was hitting the wall repeatedly because three separate systems were contributing:

**Branch protection `strict=true`.** When `required_status_checks.strict` is `true`, any time `main` moves, the PR's checks have to run again after another rebase. A dry run against the live org showed most venture repos enforcing this via a GitHub ruleset - not classic branch protection, rulesets. That's a fleet-wide tax paid on every PR in every active repo.

**Bare `--force` warnings conflated with `--force-with-lease`.** The warning text in the guardrails didn't distinguish the two operations. `--force-with-lease` is safe - it fails if the remote has diverged since you last fetched. Bare `--force` is not safe - it overwrites unconditionally. The agent was reading the force-push warning and pausing even on `--force-with-lease` flows.

**Routine git ops flagged as escalation triggers.** `git merge origin/main` on a feature branch is the opposite of merging into main. `git pull --rebase origin main` is standard update. `gh pr merge --admin` is a server-side merge, not a force-push at all. All three are common, all three are safe, and all three were producing unnecessary confirmation pauses.

---

## The fix: four PRs, layered by what they touch

### Layer 2 first - the rubric (PR #781)

The rubric is the load-bearing piece, so it shipped first. Two additions to the always-loaded enterprise CLAUDE.md and the venture template: a "Git Authority" subsection that covers branch classes and a full reference module at `docs/instructions/git-guardrails.md`.

The key addition is a mechanical test for branch ownership. At session start, capture:

```bash
SESSION_START_SHA=$(git rev-parse HEAD)
```

Then, when evaluating whether a force-push is pre-authorized:

```bash
git log "origin/$BRANCH" --not "$SESSION_START_SHA"
```

If that command returns empty, no remote commits have arrived on the branch since the session started. The branch is owned. Force-push with lease is pre-authorized. If it returns non-empty, another session has pushed since you started. Ask once before force-pushing.

That replaces an unfalsifiable heuristic ("is this my branch?") with a falsifiable test. The previous approach required the agent to reason about session history from memory. The new approach is a command you run. Either it returns output or it doesn't.

The module also enumerates the false-pause list explicitly: `git merge origin/main` on a feature branch (not merging into main - merging main into the feature), `git pull --rebase origin main`, `gh pr merge --admin` (server-side, not a force-push). These should not trigger escalation.

Hard blocks survived unchanged: bare `--force`, force-push to `main`, `reset --hard` against uncommitted changes, `branch -D` against unmerged work, rewriting published commits on protected branches.

### Layer 1 - branch protection (PR #782)

A new `scripts/fleet-branch-protection.sh` handles both the classic-protection PATCH path and the rulesets PUT path. The script defaults to dry-run; `--apply` requires an explicit flag.

Dry-run output against the live org confirmed the affected repos. The canonical branch protection JSON was updated to set `strict=false`. The script wires into new-venture setup so future ventures inherit the profile automatically.

The apply step is Captain-confirmed because it modifies shared infrastructure across production repos. The risk accepted: with `strict=false`, two PRs that each pass CI on their own snapshots can both merge and break main if their changes conflict. The backstop is the fleet health audit's existing `ci-failed` finding type, which surfaces a red main within 24 hours. Velocity profile - Dependabot-dominated, low parallel concurrency - makes the failure mode rare enough to accept.

### Layer 3 - drift detection (PR #783)

Two new finding types added to the fleet health audit: `branch-protection-strict` (ERROR) fires when `strict` returns to `true` on any venture main, and `protection-check-failed` (WARN) fires on non-200 responses so a silent 403 from a token-scope gap shows up as a visible warning rather than false-green.

The audit queries both classic branch protection and rulesets per repo, with a status-code dispatch: `200` plus `strict=true` produces an ERROR; `200` plus `strict=false` is a no-op; `4xx`/`5xx` produces a WARN with the status code for triage. Both new finding types ride the existing snapshot-diff auto-resolution and SOS Fleet Health rendering pipeline - no new display code needed.

A pre-merge gate verifies the audit token can read protection settings; it falls back to GitHub App credentials if the primary token lacks the scope.

### PR #780 - canonical PR template

Same-week follow-up to a related cross-cutting PR. The canonical PR template reached its full 8-section shape: Summary, Linked issue, AC status, Deferred ACs, Test plan, Security Checklist, Feature Impact, Deployment Notes. Existing templates on prior PRs had been trimmed to 5 sections; this PR brought back Security Checklist, Feature Impact, and Deployment Notes and dropped legacy sections that had drifted in from older venture templates.

---

## What makes a rubric durable

Heuristics live in agent prompts. They drift. They don't survive model swaps, session restarts, or new ventures spinning up. A rule that exists only as a judgment call degrades across the fleet as different agents make different calls in different sessions.

A mechanical test is portable, falsifiable, and inheritable. The `SESSION_START_SHA` pattern is a command. Commands either return output or they don't. Every new session that loads CLAUDE.md picks up the same rule, runs the same command, and gets the same answer. It doesn't require context from previous sessions.

When the friction report came in, the right question wasn't "how do we help this one agent get past the wall." It was "why does the wall exist, what else does it touch, and how do we write the rule so the fleet inherits the fix." Three friction sources, four PRs, one rubric that doesn't need to be taught again.

When an AI workforce hits the same wall repeatedly, the answer is to document the mechanical rule - not the heuristic, not the vibe. Heuristics rot. Test commands don't.
