---
title: 'Filesystem isolation for parallel agent sessions'
date: 2026-05-05
tags: ['agent-operations', 'parallel-execution', 'reliability']
draft: false
---

We shipped a three-layer hook system that forces per-session git worktree isolation when two Claude Code sessions are detected on the same repo. This is the operational record - baseline measurements, spike results, fleet matrix, deferred scope, and the smoke test we have not run yet.

## The pre-launch baseline

Before shipping anything we ran `parallel-isolation-metrics.sh` against session logs. The measurement counts active-tool-call overlap pairs: sessions whose actual tool-use timestamps fall within each other's range, ignoring idle time. Session-range overlap produces inflated numbers because sessions stay open while the agent is thinking or waiting on CI. Tool-use timestamps are sharper.

| Repo        | Sessions | Overlap pairs (active-tool-call) | Days with overlap |
| ----------- | -------- | -------------------------------- | ----------------- |
| Console A   | 20       | 18                               | 5                 |
| Console B   | 12       | 7                                | 4                 |
| Other repos | —        | 0                                | 0                 |

Five collision pairs per day at peak, across two repos. Other repos had zero overlap because they see single-session usage. Post-launch we expect both active repos to drop near zero. Clone-fallback rate is the canary: if APFS detection regresses, the rate will show it before the install-time penalty becomes invisible.

## What shipped

Three layers, no coordination service in the loop.

**Detection (~50ms):** `pgrep -x claude` lists peer processes; `lsof -p <pid> -a -d cwd` reads each peer's working directory; `git rev-parse --show-toplevel` compares repo roots. If a sibling session is on the same repo, a marker file is dropped. Kernel-maintained process state only - no heartbeat dependency.

**Enforcement:** A `PreToolUse` hook with a `*` matcher runs before every tool call. While the marker is present and the current directory isn't inside `.claude/worktrees/`, non-`EnterWorktree` tool calls are denied. This closes a gap from an existing anti-pattern check that trusted the tool's claim of isolation rather than reading the observed cwd. The new hook reads where the process actually is and makes the decision itself.

**Provisioning:** A `PostToolUse` hook on `EnterWorktree` clones `node_modules` before the session runs any tools. Marker removed on success; if provisioning fails partway through, the marker stays and the enforcement hook keeps the session blocked.

## APFS spike results

The provisioning path using APFS copy-on-write needed real-world validation before relying on it. We ran against two real repos, not synthetic data:

| Test                               | Result                       |
| ---------------------------------- | ---------------------------- |
| 158M repo clone                    | 2.3s                         |
| 484M repo clone                    | 4.9s                         |
| Symlinks (38) preserved            | All resolve                  |
| `.bin/astro --version` from clone  | `astro v6.1.7`               |
| `.bin/vitest --version` from clone | `vitest/3.2.4`               |
| Cache writes in clone              | Don't propagate to canonical |
| Inodes                             | Separate (CoW)               |
| Mutation in clone vs canonical     | Independent                  |

A `npm ci` on the 484M repo takes around 30 seconds. The clone path cuts that to 4.9 seconds. The CoW semantics work correctly - writes in the cloned `node_modules` don't touch the canonical copy, and the executables in `.bin/` resolve cleanly.

Sharp edge discovered during the spike: `cp -c` on non-APFS volumes exits 0 and silently falls back to a regular full copy. No warning, no exit code change. Without a precondition check, the 30-second install tax would creep back in on any non-APFS mount with no signal. The hook now gates the clone path with a `diskutil info` check on the resolved mount point before attempting it.

## Fleet mount-flag matrix

| Machine | OS    | Filesystem              | Clone path                             |
| ------- | ----- | ----------------------- | -------------------------------------- |
| m16     | macOS | APFS                    | `cp -c -R`                             |
| mac23   | macOS | APFS (sealed/journaled) | `cp -c -R` (verified, separate inodes) |
| mini    | Linux | ext4                    | `npm ci` fallback                      |
| mbp27   | Linux | ext4                    | `npm ci` fallback                      |
| think   | Linux | ext4                    | `npm ci` fallback                      |

Two macOS workstations use `cp -c -R`. Three Linux fleet machines fall back to `npm ci`. The fallback is explicit and deterministic - not a silent degradation path, but a named branch in the provisioning script.

## Branch-naming tripwire

A pre-commit hook rejects commits from inside `.claude/worktrees/<id>/` whose branch name doesn't contain `<id>`. Commits from the canonical working tree are unaffected. Without this, a worktree session could accidentally land a commit on a shared branch - the pre-commit fires before the commit is written, so there's nothing to undo.

This hook ships only to the primary repo where we did the work. Rolling it out to the rest of the portfolio is a follow-up.

## What we rejected

**Always-on worktrees** - force every session into a worktree from the start, regardless of whether another session is present. Most sessions are solo. The provisioning cost and worktree management overhead aren't justified when there's no collision risk. Isolation should be conditional on actual parallel activity, not assumed.

**A coordination service** - a small process tracking which session holds which directory. The coordination problem is already solved by `pgrep` reading kernel-maintained process state. Adding a service puts it on the critical path of every session start. The kernel is already doing this work; we just read it.

## Smoke test pending

One test remains deliberately deferred to post-merge: open two Claude Code sessions on the same repo, confirm the second is forced into a worktree with a cloned `node_modules`, and verify both can ship independent PRs without contamination. The provisioning path has been tested end-to-end in isolation. The integration test - two real concurrent sessions, real PRs - hasn't happened yet under the new system.

That test will happen in the next parallel sprint on one of the active repos. Either it works and the baseline numbers start dropping, or something surfaces that unit-level testing missed.

## What's deferred

Branch-naming hook rollout to other repos is a follow-up - this PR ships only to the one repo where the work was done.

Venture-wide `pnpm` migration is a separate project. It would simplify the `node_modules` story long-term but wasn't on the table here.

Fleet-dispatch-as-default for parallel sessions - routing every parallel session to a fleet machine rather than isolating locally - is a different posture and a different conversation. Local parallel isolation solves the contamination problem for daily work without requiring fleet dispatch for every task.

The two-week metric check is on the schedule: `parallel-isolation-metrics.sh` weekly, watching overlap counts and clone-fallback rate across the two repos that had active overlap before launch.
