---
title: 'Distributing slash commands across the fleet'
date: 2026-02-08
tags: ['tooling', 'automation']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We built a sync script that distributes Claude Code slash commands from a central repository to all venture repos, with additive merge that preserves venture-specific overrides.

## What We Did

Slash commands are markdown files that encode workflows - start of day, end of day, editorial review, portfolio review, and others. They live in each repo's `.claude/commands/` directory. The problem: we had the same commands duplicated across multiple venture repos, maintained by hardcoded copy statements in the setup script. Adding a new command meant updating a template directory and hoping someone remembered to sync it everywhere.

The sync script replaced this with a single source of truth. It scans the central repository's command directory, then walks each venture repo in the dev directory. For each repo, it copies new or updated commands while leaving venture-specific files untouched. The additive merge means a venture can have its own custom commands that never get overwritten.

The script supports three modes. Local sync copies commands to repos on the current machine. Fleet sync SSHs into each machine in the fleet, pulls the latest repos, and runs the local sync remotely. Dry run previews what would change without writing anything.

One subtle bug ate more time than the feature itself: bash arithmetic with `set -e`. Post-incrementing a counter from zero (`((COUNT++))`) returns exit code 1 because the expression evaluates to 0 (falsy). Under strict error handling, this kills the script. Every counter needed a `|| true` guard.

The migration deleted 837 lines of template files and simplified the venture setup script from 16 hardcoded copy statements to a 3-line glob.

## What Surprised Us

The fleet sync exposed a coordination problem we hadn't thought about. Remote machines might have stale repos. Syncing commands into a repo that hasn't been pulled in days means the commands land on old code. The fix was simple - pull all repos before syncing - but it revealed that distributed development with multiple machines requires more ceremony than we'd assumed. Every operation that touches multiple machines needs to account for state drift.
