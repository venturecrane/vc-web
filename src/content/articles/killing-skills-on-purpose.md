---
title: 'Killing Skills on Purpose: A 32-to-24 Retirement Cascade'
date: 2026-04-23
description: 'How a full-day audit cut a 32-skill catalog to 24 - and the operational tests that determined what earned retirement vs. what earned a stay.'
author: 'Venture Crane'
tags: ['agent-tooling', 'process', 'agent-operations']
draft: false
---

The session started with 32 custom skills loaded into the enterprise harness. It ended with 24. Eight skills retired, two trimmed, one partially folded into another, plus the deprecation lifecycle itself killed for being unused. The full count is higher - 10 individual deletions if you follow the PR trail - but the math is close enough: roughly a quarter of the catalog gone in one day.

This is a report on how that happened, why those specific skills got cut, and what the operational test was for each one.

## Why Catalogs Bloat

Skill catalogs bloat the same way config files do. You add a skill for a specific need, the need goes away, and the skill stays. Nobody removes it because removal feels riskier than keeping it. The skill is "probably used somewhere." The documentation says it exists. Maybe agents still invoke it.

At 32 skills, the catalog had become noise. An agent loading context at session start has to hold the full catalog in working memory. Skills that are never invoked still consume that space. Skills whose descriptions no longer match their implementations can send agents down wrong paths. Dead code in a catalog is worse than dead code in a library - it actively misleads.

The audit ran a simple question against each skill: when was this last invoked, does the tool it calls exist, and does the SKILL.md still match reality?

## What Got Retired and Why

**`/docs-refresh`**: 0 invocations in 90 days. The target files - docs for each venture - were being updated through ordinary feature-work PRs anyway. Five such PRs in the prior 90 days, none of them touching the `/docs-refresh` skill. The skill had been bypassed, not used, without anyone making a deliberate decision to bypass it.

**`/analytics`**: Scope drift. The underlying capability it was meant to surface never fully materialized into something agents could reliably invoke.

**`/go-live`**: Process had evolved past it. The go-live sequence for new ventures now happens through a direct PR workflow, not a skill. Same outcome, one fewer layer.

**`/work-plan` and agent-browser docs**: The Weekly Plan concept was cut as part of the same session - not just the skill, but the `crane_plan` MCP tool (20 tools down to 19), the SOS rendering section, the planning directory, and the shell script step that referenced it. When you retire an abstraction, retire the whole abstraction. The cross-repo cleanup followed: five venture PRs removing the tracked `/work-plan` copies. Fleet machines had the agent-browser CLI uninstalled the same way - a retirement script run across five machines, consistent with how setup was originally done.

**`/heartbeat`, `/update`, `/status`**: These three came out together in one PR. `/heartbeat` referenced a `crane_heartbeat` MCP tool that does not exist. The slash-commands guide already documents that session heartbeats are automatic. `/update` referenced a `crane_update` MCP tool that also does not exist. `/status` had a real backing tool (`crane_status`) but that tool returns a GitHub issue breakdown - not session status. The skill's description and the tool's actual output had drifted into different scopes.

Zero invocations across the fleet in 90-day telemetry for all three. They were not retired because they were not useful in theory. They were retired because they had no working implementation.

**`/skill-deprecate`**: This one is worth examining because it is meta. The deprecation skill went 90 days with zero invocations. Every real retirement in that period bypassed it - direct Captain-directive delete PRs, no skill invoked. The lesson: we built a graceful deprecation lifecycle and then consistently chose the faster path instead. That consistent bypass is itself data. Remove the skill, remove the `deprecated` status enum value from the validator, remove the ~65 lines of deprecation sanity checks, remove the audit path that queried it. If you are not using the retirement machinery, the machinery is overhead.

## Two Trims Instead of Full Retirements

Not every skill that had problems needed to die. Two got trimmed instead.

**`/code-review`** had Phase 2 vaporware baked in. The SKILL.md described a multi-model convergence phase using additional agents for review. That phase was never built. The `--quick` flag had no second mode to opt out of. Removing the vaporware left a leaner skill that matches what actually runs.

**`/context-refresh`** was partially folded into `/sos`. The first two steps - audit D1 docs and auto-regenerate stale or missing docs - are read-only and idempotent. They can run automatically as a cadence-gated side effect of session start. The remaining steps (executive summary review, venture config drift) require Captain judgment and stay on explicit invocation. Folding routine mechanical work into SOS removes the "remember to run this" failure mode without eliminating the skill entirely.

## The Dependabot Thread

Running parallel to the skill audit: Dependabot auto-merge across the enterprise. The same session shipped a GitHub Actions workflow that auto-merges patch bumps, dev-dependency minors, and security patches once CI passes - applied to the enterprise console and all venture repos.

The connection to skill retirement is not accidental. Manually reviewing Dependabot PRs was ape-in-the-loop work. Someone (or an agent) had to look at a patch bump, confirm it was safe, and merge it. Automating that at the config layer eliminated the manual step without building a skill to handle it. That is the better pattern: when the work is routine, automate it with the platform's native tooling instead of wrapping it in a slash command that has to be invoked manually.

The skill retirement session and the Dependabot automation session happened to overlap. But they express the same principle: identify work that exists as overhead, then eliminate the overhead. Either by deleting the skill or by making the skill unnecessary.

## The Operational Test

The audit criteria were not complicated:

1. **Invocation count in 90-day telemetry.** Zero invocations is the clearest signal. It does not prove a skill is worthless - some skills are emergency procedures invoked rarely by design. But zero invocations combined with any other problem is sufficient cause for retirement.

2. **Does the backing tool exist?** Skills that call MCP tools that were never built are broken by definition. They cannot be invoked successfully regardless of how well the SKILL.md is written.

3. **Does the description match the implementation?** Scope drift between what a skill claims to do and what it actually does is worse than a missing skill. An agent invoking a skill based on its description will be misled.

4. **Is the work happening anyway?** If the work the skill enables is getting done through other means - direct PRs, native platform tools, other skills - the skill is not load-bearing.

Any skill that fails multiple criteria without a clear path to repair gets deleted, not placed in a "deprecated" queue. The deprecation queue itself got deleted for this reason.

## What Stays and Why

The 24 skills that survived passed the operational test. They have invocations. They have backing implementations. Their descriptions match their behavior. They do work that is not happening through any other path.

The catalog is not smaller because small is better. It is smaller because the 8 skills that left were not doing anything useful. The 24 that remain have fewer false positives around them - when an agent scans the catalog for a relevant skill, there is less noise to filter through.

The candidate identified for next session: a `/retire-skill` skill encoding the pattern just executed 10-plus times. Delete the directory, update dispatchers, clean skill-owners.json, grep-clean the docs, verify, PR. Whether that gets built depends on whether the retirement workflow keeps recurring. One full-day audit does not establish the pattern. Two or three would.

## The Broader Point

Kill discipline for AI agents - knowing when to stop a task, when to escalate, when to declare a problem unsolvable - is a concept worth applying to the infrastructure those agents operate within. A skill catalog is a surface that requires the same discipline.

Every skill that remains is a claim: "this is useful enough to occupy space in every agent session that loads it." That claim should be audited. The cadence at which you audit is up to you. But leaving it unaudited produces exactly the kind of catalog we started with - 32 entries, a quarter of which were either broken, redundant, or no longer invoked.

Start with the 90-day telemetry. The zeros tell you where to look first.
