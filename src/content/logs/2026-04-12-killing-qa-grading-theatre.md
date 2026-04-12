---
title: 'Killing the QA grading theatre'
date: 2026-04-12
tags: ['process', 'infrastructure', 'cleanup']
draft: false
---

We built an automated QA grading pipeline that classified every new GitHub issue into verification tiers using Gemini Flash. It was well-engineered - dual-layer idempotency, D1 audit logging, acceptance criteria extraction, test-required detection. Deployed across all venture repos with process documentation, PR templates, agent skills, and a CI workflow for test enforcement. 603 issues were graded. Zero were ever acted on by code.

## What it was

When a new issue landed in any venture repo, the webhook processor caught the `issues.opened` event, sent the issue title, body, and extracted acceptance criteria to Gemini 2.0 Flash, and applied a verification label: qa:0 (automated - CI covers it), qa:1 (CLI-verifiable), qa:2 (light visual), qa:3 (full UI walkthrough). It also detected whether the issue required unit tests based on calculation logic, financial computations, or state machine transitions - applying a `test:required` label and enforcing it through a CI workflow that blocked PRs without test changes.

The system had a Gemini prompt tuned to temperature 0.1, a JSON response schema enforced server-side, two layers of idempotency (delivery ID and semantic content hash), a dedicated D1 database for audit logging, and a `/regrade` API endpoint for re-classifying existing issues in bulk.

## Why it died

The grading system produced labels. Nothing consumed them. No CI workflow gated on QA grade. No agent routing logic branched on the label value. The sprint and orchestrate commands extracted the grade into a display table, then ignored it. Process documentation prescribed routing ("qa:2+ goes to the Captain for visual review") that no code enforced.

It was worse than unused - it was contradictory. Two label schemas ran simultaneously. The root CLAUDE.md documented a five-level `qa-grade:N` system (0-4, including a security tier). The classifier applied a four-level `qa:N` system (0-3). Both schemas existed on the same issues. 17 of 29 dual-labeled issues had mismatched grades between the two systems. An issue might carry `qa-grade:0` (CI-only) and `qa:1` (needs CLI verification) simultaneously - contradictory signals to any agent reading them.

The `test:required` CI workflow was the only piece with enforcement teeth. But the signal was unreliable - Gemini's classification plus regex heuristics didn't match actual test needs, and the workflow could be satisfied by touching any file ending in `.test.ts` regardless of what it tested.

## What we removed

The discovery happened during a billing investigation. An $11 Anthropic API charge triggered a deep dive into what was consuming API credits. That led to auditing all LLM-powered features across the enterprise, which surfaced the QA grading system as infrastructure without a consumer.

Removal was surgical. The webhook gateway worker handles three other active concerns - CI notification forwarding, deploy heartbeat observation, and Vercel webhook handling. We cut only the QA grading code path: the Gemini classifier, the GitHub App JWT auth for label writes, the D1 database, the `/regrade` endpoint, and all the skip/idempotency logic. The worker went from 1,347 lines to 395.

Then we swept all venture repos in parallel - each one lost its `test-required.yml` workflow, QA grade sections from PR templates, grade extraction from sprint and orchestrate commands, and QA references from their CLAUDE.md files. One repo had QA grading wired into runtime application code, requiring source-level surgery instead of config-file cleanup.

Cloud infrastructure cleanup followed: two D1 databases deleted, Gemini API secrets removed from the worker, 63 GitHub labels deleted across all venture repos (with a snapshot of all label assignments captured first), and the GitHub App's issues event subscription queued for removal.

Eight PRs merged, 2,400+ lines deleted across the enterprise.

## What we learned

We built the signal before the consumer existed. The grading pipeline was infrastructure-first - classify every issue now, build routing later. Later never came. The Gemini API cost was negligible; the real cost was 60+ files of process scaffolding across all repos that created the illusion of verification routing without any enforcement behind it.
