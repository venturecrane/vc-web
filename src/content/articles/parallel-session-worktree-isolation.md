---
title: "Parallel-session worktree isolation: when one agent's `git add -A` sweeps another's edits"
date: 2026-05-05
description: "Two sessions on the same repo. One runs git add -A. The other's uncommitted work ships in the wrong PR. The fix is filesystem isolation, not branches."
author: 'Venture Crane'
tags: ['agent-operations', 'parallel-execution', 'reliability']
draft: false
---

Two Claude Code sessions. Same repo. One session runs `git add -A` to stage a clean commit. The other session has been writing files for the past twenty minutes but hasn't committed yet. Both sessions are on separate branches. Neither session knows the other exists at the filesystem level.

The result: the second session's uncommitted work gets swept into the first session's commit and ships in the wrong PR. The file is in the wrong branch's history. The second session doesn't notice until it tries to commit and finds its working tree clean.

We were seeing roughly five of these collision pairs per day across two active repos before shipping a fix. This article explains what caused it, why branch isolation doesn't help, and what does.

---

## Why branches don't protect you

The naive mental model of parallel git work treats branches as isolated containers. Two agents on two branches should be safe.

They aren't. Git branches track commits. The working tree - the actual files on disk - is shared between all branches checked out in the same directory. When agent A runs `git add -A`, it stages every modified and untracked file in the repo, regardless of which branch either agent is on. If agent B wrote a file but didn't commit it, agent A's `git add -A` picks it up.

This is not a git bug. It is how git works. The staging area and working tree are per-directory, not per-branch. Branch isolation is commit-level isolation, not filesystem-level isolation. You cannot fix this by disciplining agents to use `git add <specific-files>` instead of `git add -A` - the agents are separate processes with no coordination, and `git add -A` is a reasonable operation in a clean session.

The fix has to live below git, at the filesystem.

---

## What we shipped

The implementation forces each Claude Code session into its own git worktree when a sibling session is detected on the same repo. Git worktrees give each session a separate directory on disk. `git add -A` inside one worktree cannot touch files in another. The contamination class disappears.

Three layers do the work, all kernel-reliable, no coordination service in the loop.

### Detection

At session start, a detection script checks for sibling Claude Code processes on the same repo. The sequence takes about 50ms:

1. `pgrep -x claude` lists all running Claude Code processes
2. `lsof -p <pid> -a -d cwd` reads each peer process's working directory
3. `git rev-parse --show-toplevel` compares repo roots

If a sibling session is working in the same repo, the script drops a marker file. No heartbeat service, no coordination database. Just `pgrep` and `lsof`, both reading kernel-maintained process state.

### Enforcement

A `PreToolUse` hook with a `*` matcher runs before every tool call. While the marker file is present and the current directory isn't inside `.claude/worktrees/`, the hook denies non-`EnterWorktree` tool calls. The agent cannot use any other tool until it moves into an isolated worktree.

This closes a gap we'd been carrying. A previous anti-pattern check verified that worktree isolation was configured, but trusted the tool's claim that it had created an isolated directory rather than checking where the process actually was. The new hook reads the observed cwd and makes the decision itself.

### Provisioning

When `EnterWorktree` completes, a `PostToolUse` hook provisions the worktree. The main cost of a worktree is `node_modules` - if you're working in a JavaScript repo, installing dependencies from scratch adds 20-30 seconds.

On APFS volumes (all macOS machines in the fleet), the hook uses `cp -c -R` to clone `node_modules`. APFS copy-on-write means a 484M `node_modules` directory clones in about 4.9 seconds. The clone shares blocks with the original until one of them writes - at which point only the modified blocks are copied. A fresh `npm ci` takes around 30 seconds for the same directory.

On non-APFS volumes (Linux fleet machines running ext4), the hook falls back to `npm ci`. The fallback is deterministic and fast enough.

One sharp edge: `cp -c` on non-APFS volumes exits 0 and silently falls back to a regular full copy. There's no warning. Without a precondition check, the 30-second install tax creeps back in invisibly on any non-APFS mount. The hook gates the clone path with a `diskutil info` check on the resolved mount point before attempting the clone. We caught this before shipping by running a real spike - synthetic and real-world tests against a 484M repo - rather than reasoning about it from the man page.

The marker file is removed only on successful provisioning. If provisioning fails partway through, the marker stays and the enforcement hook keeps the session blocked.

---

## Namespacing worktree branches

A pre-commit hook adds a tripwire: if a commit originates from inside `.claude/worktrees/<id>/`, the branch name must contain `<id>`. Commits from the canonical working tree are unaffected. This keeps worktree branches namespaced and prevents a worktree session from accidentally pushing to a shared branch.

---

## Pre-launch baseline

Before shipping, we ran an active-tool-call overlap analyzer against session logs. Active-tool-call overlap counts pairs of sessions whose actual tool-use timestamps overlap - not just sessions that were open at the same time, which would include idle sessions and produce inflated numbers.

Across five days on one repo: 18 overlap pairs. Across four days on another: 7 overlap pairs. Both repos had daily overlap. Post-launch, we expect both to drop near zero.

Clone-fallback rate is the canary metric. If APFS detection regresses - a mount-point check that returns the wrong result, a filesystem that identifies as APFS but doesn't support `clonefile` - the fallback rate will show it before the 30-second install tax becomes invisible again.

---

## What we rejected

Two alternatives came up during the design review.

**Always-on worktrees** - force every session into a worktree from the start, regardless of whether another session is present. The problem: most work is solo. The provisioning cost and worktree management overhead aren't justified when no collision risk exists. Isolation should be conditional.

**A coordination service** - a small process tracking which session is in which directory, coordinating access. The problem: it adds a service to the critical path of every session start. `pgrep` already does what the coordination service would do. Prefer the kernel over a service you have to keep running.

What shipped is conditional isolation. Detect first, isolate only when needed.

---

## The generalizable point

When parallel processes share state through the filesystem, branch isolation isn't isolation. Git operates on the working tree. Whoever runs `git add -A` first sweeps everyone's untracked work. The fix lives at the filesystem layer, not the git layer.

This shows up in other contexts too. Two agents writing to the same config file, the same cache directory, the same temp file - branches don't protect any of it. The isolation has to match the layer where the conflict actually lives.

For git contamination specifically, the solution is git worktrees. Each session gets its own directory. `git add -A` is scoped to that directory. The contamination class doesn't exist.
