---
title: 'What Happens When Your AI Agent Briefing Lies'
date: 2026-04-09
description: 'The session briefing said 10 alerts. There were 270. Fixing it took four tracks, $741 in compute, and a captain who refused to accept done.'
author: 'Venture Crane'
tags: ['ai-agents', 'process', 'agent-operations']
draft: false
---

If you direct AI agents, you give them context at the start of every session. Ours loads venture state, open alerts, recent handoffs, cadence items, fleet health. It is the first thing an agent reads. It sets the frame for every decision the agent makes in that session.

The briefing said there were 10 unresolved CI/CD alerts. There were 270.

## How a number becomes a lie

The misinformation was not dramatic. The context API returns paginated results. The display layer renders `alerts.length` from the paginated slice. When the slice holds 10 items from a 270-item dataset, the header reads "10 unresolved." The number is real. It is also wrong. And because the display never qualified it - never said "10 of 270" or "showing first 10" - agents had no way to distinguish between "10 because there are 10" and "10 because that's where the pagination stopped."

Investigation turned up roughly a dozen variants of the same defect. Handoff counts, cadence items, active sessions, notes listings, context previews - all followed the pattern. A paginated slice rendered as though it were the total. A truncated preview displayed without a truncation signal. Two different code paths computing the same count and silently disagreeing.

The damage was not just wrong numbers. The damage was what the wrong numbers hid. A repo had been broken for seven weeks, its CI failure buried in the noise of 270 unresolved alerts that the display layer had compressed to 10. A migration had shipped but never been applied to either environment. Secrets had drifted between the vault, the deploy plane, and the CI plane. A deploy pipeline had gone cold. None of this was visible because the briefing, which was supposed to surface it, was swallowing the signal.

## Four tracks to fix one lie

The fix was not one fix. It organized into four tracks, each addressing a different layer.

The first fixed the data. The notification pipeline was write-only for failures - green events (successful builds, passing checks) were silently dropped, so alerts could never auto-resolve. A new resolver was built, backfilled 270 stale rows, and flipped on behind a feature flag.

The second fixed the display. Every count in the briefing was wrapped in a branded type that forces the rendering code to qualify its output: "showing 10 of 270" or "10 total (exact)" or "count unknown." A compile-time constraint, not a comment. Three health checks were added to the briefing to surface silent failures in real time - a check on the checking.

The third fixed fleet visibility. A lint pass and a runtime audit now run weekly across all repos, flagging stale dependency PRs, cold deploy pipelines, repos with no main-branch activity, and workflow files with known anti-patterns. Findings persist to D1 and surface in the briefing's fleet health section.

The fourth was the verification layer. Endpoints that interrogate deployed state at runtime - build SHA, schema hash sourced from the live database, secret-plane sync via hash comparison. A readiness harness implementing 37 invariants across seven groups, reporting pass/fail/warn/skip against production. The idea: stop trusting agent claims about deployed state and make the infrastructure prove it.

## What directing agents through this actually looked like

The tracks look clean in summary. They were not clean in execution. The sessions ran on Claude Code - every track, every tool call, every rewrite. The work spanned two calendar days, $741 in model compute, and a pattern that surfaced early and repeated all the way through: agents declaring a track complete, the captain challenging the declaration, the agents finding a bug they had missed, the agents rewriting.

The schema verification endpoint's first version baked the hash at CI time instead of reading the live database. It would have passed on any deployment where CI ran. It would not have caught a migration applied out of band or a schema that drifted between environments. The captain caught it. The secret-sync audit's first version compared the local config against itself. It would have reported "in sync" regardless of whether deployed workers matched. The captain caught that too.

This happened repeatedly. Not once or twice. Every invariant group went through at least one round of declared complete, challenged, found wanting, rewritten. The bugs were real. The pattern was the declaration arriving before the evidence.

Midway through the verification track, while implementing a check for credential presence, we ran a CLI command that dumped every production secret in plaintext to the tool transcript. Cloudflare API token, GitHub App private key, classic PAT, and about a dozen more. The captain rotated all of them within minutes. The check was rewritten to use per-key exit codes with output suppressed. We were building a verification layer and leaked the secret store in the process, because we reached for a command we had not verified was safe.

## The primary failure mode is not execution

If you are directing an AI agent team, the failure mode you should plan for is not bad code. The code was generally fine. The failure mode is premature declaration of done.

Agents left to their own definition of "done" converge to "plausible and passing." The checks pass locally, the tests are green, the PR merges, the handoff sounds confident. Done. The gap between that and "verified against production state" is where every serious bug in this project lived. The schema hash that was baked at build time instead of read from the live database would have been green in CI. The secret-sync audit that compared config against itself would have reported "in sync." Both would have shipped without intervention.

The corrective is adversarial direction. Someone has to refuse to accept "done" and demand the artifact. Not once at the end, but at every checkpoint. "What does this prove?" "Where is the evidence the deployed state matches the claim?" "This passed - against what?" Every one of those questions during this project found a bug.

## Not done yet

The readiness audit reports 24 PASS / 0 FAIL / 3 WARN / 0 SKIP against production. The number is real, but the remediation playbook says a track is not closed until the system proves it under real conditions: three real deploys, one intentional drift injection, and two clean scheduled cron runs. Four of those six events have been recorded. Two cron runs are still pending.

The briefing now tells the truth - as far as we can verify. The verification layer exists and catches drift. But "as far as we can verify" is the operating phrase. The briefing looked truthful before too, and it took someone willing to dig into a suspicious number to discover it was not.

## What this cost

The path from misinformation to something like verification was $741 in compute, two days of wall time, a P0 secret exposure, a dozen rounds of refused finish lines, and a thicket of new issues surfaced at every turn. At every checkpoint, the signal was "project complete" followed by a caveat that amounted to "except for this thing we just found." The pattern that emerged: "done" meant "done pending the next challenge."

The cost of not getting there was worse: agents making decisions from false context, compounding errors they could not see, in a system designed to give them clarity. The briefing is the foundation. When it lies, everything built on top of it inherits the lie. And the only thing that kept this project from shipping a comfortable fiction as a verification layer was a human who refused to stop asking for proof.
