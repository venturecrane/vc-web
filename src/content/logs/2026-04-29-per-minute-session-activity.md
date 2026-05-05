---
title: 'Per-minute session activity from JSONL'
date: 2026-04-29
tags: ['agent-operations', 'observability', 'session-management']
draft: false
---

Two PRs shipped today. The first added a `session_activity` table and the endpoints to populate it. The second fixed an immediate edge case that surfaced on the first real `/eos` run after deploy. Both are in production.

## What shipped

Migration 0043 added two schema changes: a `client_session_id` column and a `session_activity` table with a primary key on `(session_id, minute_bucket)`. The PK does the deduplication work - posting the same minute twice is a no-op.

`POST /sessions/:id/activity` accepts a batch of JSONL timestamps and writes one row per unique minute bucket via `INSERT OR IGNORE`. Events outside the session's `[created_at, ended_at]` window return 422, which makes caller bugs visible. The endpoint does not silently drop bad data.

`GET /sessions/prior` returns the most recently finished session matching a given agent, venture, repo, and optional track and host. The session-history block-merger was extended to join `session_activity` and project per-minute buckets into contiguous ranges using the existing 30-minute gap threshold. Sessions without activity rows fall back to `(created_at, last_activity_at || ended_at)`, keeping sessions from agents that don't produce JSONL transcripts visible.

A 180-day retention sweep was added to the existing scheduled cron. No new infrastructure dependency - the sweep piggybacks on the cron that was already running.

The MCP server gained `extractActivityEvents()`, `getClientSessionId()`, and `jsonlPathFor()` exports; `postSessionActivity()` and `getPriorSession()` for the API calls. `/sos` now fetches the prior session and posts its JSONL activity. `/eos` posts the current session's activity before closing it. Both are best-effort - failures log and continue, never blocking the primary flow.

## The immediate follow-up

The first real `/eos` after deploy failed silently. Claude Code writes session-start hook entries 5-10 seconds before `/sos` records `created_at`. Those pre-start entries fell outside the session window, and the endpoint was rejecting the entire batch on any out-of-window event. The `try/catch` in the `/eos` backfill path swallowed the 422, so every session was failing without alerting.

The fix moved from batch rejection to per-event filtering. Out-of-window events are dropped and counted in `skipped_out_of_window`; the rest of the batch proceeds. Validated against the live session that triggered it: 1,100 raw JSONL events, 1,090 in-window, 82 unique minute buckets recorded. Session history split a 10.7-hour overnight pause into two blocks correctly.

## How we verified

The migration ran `compute-schema-hash.sh --verify` clean. The MCP test suite (564 tests) and context worker test suite (457 tests) were both green across both PRs.

For the activity endpoint specifically, we added a new harness suite with seven cases driven against an in-process D1: pre-`/sos` slop drops, post-`/eos` drops, all-out-of-window batches, within-batch deduplication, PK collision, and 404 on a missing session. These are the cases that matter for production correctness; they all pass.

The end-to-end checks - running a real session, querying `session_activity`, confirming the overnight-pause split - were marked as post-deploy staging steps in the PR checklist, not pre-merge gates. That's the right call for behavior that requires a live JSONL transcript to exercise.

## The drive-by that the article didn't mention

While moving code in the context worker, we found `src/endpoints/__tests__/merge-blocks.test.ts`. The file had 16 assertions. None of them had ever run. The `vitest.config.ts` pattern was `test/*.test.ts`, which matches files in the top-level `test/` directory - not `src/endpoints/__tests__/`. The file had been orphaned at some point and never discovered.

We moved it to `test/merge-blocks.test.ts`. All 16 pass. The logic they cover was correct; it just hadn't been verified by the test runner.

## What's not done

**Live hooks.** `/sos`-time backfill covers the two patterns Captain actually uses: a long overnight turn that doesn't end cleanly, and a deferred-review pause where `/eos` doesn't run. Live hooks would require a synchronous network call on every tool invocation, or a global `~/.claude/settings.json` mutation. Neither is worth it given the backfill coverage.

**Codex and Gemini activity ranges.** Those agents don't produce JSONL transcripts in the same format. The no-activity-rows fallback handles them - they stay visible in session history via `(created_at, last_activity_at || ended_at)` - but they won't have per-minute granularity until there's an equivalent transcript source.

**Pre-PR backfill.** `client_session_id` was not stored before this PR. Matching historical JSONL files to sessions by host, cwd, and timestamp is forensic work with meaningful error risk. Forward-only is the right call.

## Rollback posture

The migration was purely additive - a new column and a new table. No existing columns were modified, no data was moved. Rolling back the code with `git revert` reinstates the pre-PR block-merger, which falls back to `last_activity_at || ended_at` for all sessions. The new column and table become inert. A schema revert is not required. This was a low-risk deploy.
