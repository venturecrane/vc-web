---
title: 'Fleet Sprint Reliability Improvements'
date: 2026-02-25
tags: ['infrastructure', 'fleet-management']
draft: false
---

We shipped four PRs on February 25th improving reliability for distributed sprints across our development lab machines. The changes address three failure modes we kept hitting: agents wasting time fixing pre-existing CI failures, flaky SSH stderr classification, and stale worktrees from previous sprints causing conflicts.

## What We Did

**Scoped CI-fix attempts to changed files.** Before this, when CI failed during a sprint, agents would spend up to 55 minutes trying to fix failures that existed on main before they even started. Now agents compare failing test files against their change set via `git diff --name-only origin/main`. If failures are in files they didn't modify, they immediately write a failed result citing "pre-existing CI failure" instead of churning. Hard gate: max 3 verify attempts OR 10 minutes of fix attempts.

**Added per-machine reliability tracking.** New fleet reliability utility records dispatch counts, successes, failures, and crashes per machine. The fleet dispatch tool automatically records each dispatch. The orchestration protocol now checks reliability scores during planning and deprioritizes machines below 70% success rate. Scores persist in a local reliability tracking file.

**Pre-flight CI validation and overlap detection.** The orchestration protocol now validates that main passes CI before dispatching any tasks. We added overlap detection to prevent two agents from being dispatched to branches that modify the same files. Stuck detection threshold dropped from 20 to 10 minutes for faster intervention.

**Hardened dispatch against stderr false-failures.** SSH commands that wrote to stderr (like `git fetch` progress messages) were being classified as failures even when they succeeded. We redirected git fetch stderr to stdout in the dispatch script. We also added stale worktree and branch cleanup before dispatch with safe-delete semantics (protects unpushed work). SSH timeout increased from 15s to 60s to accommodate `git fetch` plus `npm ci`.

## What Surprised Us

The 55-minute CI churn issue came from a well-intentioned instruction: "if CI fails, fix it and retry." Agents would dutifully try to fix test failures in parts of the codebase they'd never touched. The fix wasn't more sophisticated testing - it was teaching agents to check if they caused the failure before attempting a fix.

The stderr false-failure issue was subtle. A dispatch would succeed (exit code 0), log output looked clean, but our classification logic saw git progress messages on stderr and flagged it as failed. The agent would retry, hit the same false-failure, and eventually give up. The fix: redirect stderr to stdout for operations where stderr is just informational, not an error signal.
