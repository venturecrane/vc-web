---
title: 'Per-minute session activity from JSONL: when heartbeats lie about idle time'
date: 2026-04-29
description: 'Heartbeats only fire on /sos and /update. Per-minute activity from Claude Code JSONL gives sessions an honest activity timeline.'
author: 'Venture Crane'
tags: ['agent-operations', 'observability', 'session-management']
draft: false
---

Heartbeats answer one question: is this session still alive? They don't answer a different question - when was this session actually active? Those are two distinct questions, and conflating them produces misleading timelines.

The gap surfaced during calendar sync work. The session store tracked `last_heartbeat_at`, but heartbeats only fire when an agent runs `/sos` or the session update tool. A session that ran three hours of tool calls without hitting either of those would show up as a flat span from session start to last heartbeat - wrong at both the boundary and throughout the middle. A 10-hour overnight pause looked identical to an active three-hour session.

---

## What heartbeats actually capture

Heartbeats are liveness signals. They're designed to let the system detect abandoned sessions - a useful job, and the right tool for it. The staleness check compares `last_heartbeat_at` against a threshold; sessions that stop heartbeating eventually get marked abandoned.

That design is fine for liveness detection. It's wrong for reconstructing an activity timeline. When did this session actually do work? Heartbeats can't answer that, because they fire at `/sos` and `/update` - not continuously throughout the session, and not tied to any actual tool use.

The distinction matters for calendar sync, session-history views, and any future cost accounting that needs to attribute compute time accurately. "Session ran from 9am to 11am" and "session was active from 9am to 11am" are different claims. Heartbeats only support the former.

---

## Per-minute activity from Claude Code JSONL

Claude Code writes a JSONL transcript for every session. Each line is a timestamped event: tool calls, assistant responses, hook firings. The transcript doesn't care whether the agent ran `/sos` - it records what happened.

PR #764 added a `session_activity` table with a primary key on `(session_id, minute_bucket)`. At `/sos` time, the MCP server reads the prior session's JSONL transcript and posts each event's minute bucket to the session API via `POST /sessions/:id/activity`. At `/eos` time, it does the same for the current session before closing it. The `INSERT OR IGNORE` pattern on the primary key provides natural deduplication - posting the same minute twice is harmless.

The endpoint returns `422` on events that fall outside the session's `[created_at, ended_at]` window, which makes caller bugs visible rather than silently dropping data.

A 180-day retention sweep runs on the existing scheduled cron, bounding D1 growth without a separate infrastructure dependency.

---

## The block-merger picks up the new table

The session-history view uses a block-merger that joins adjacent time ranges within a gap threshold. PR #764 extended the block-merger to pull from `session_activity`. Per-minute buckets project into contiguous ranges using a 30-minute gap threshold - the same threshold already used for block-merging. A session with three hours of tool calls followed by a 35-minute idle gap then two more hours of calls becomes two blocks, not one flat span.

Sessions without activity rows fall back to `(created_at, last_activity_at || ended_at)`. This keeps Codex and Gemini sessions - which don't produce equivalent transcripts - visible in session history without requiring separate logic.

---

## /eos is unreliable; /sos backfill is the durability story

The design assumes `/eos` will often not run. Terminal windows close, connections drop, sessions end without a clean handoff. Building durability around `/eos` would be building on an unreliable signal.

The actual durability mechanism is the next session's `/sos`. When an agent starts a new session, `/sos` reads the prior session's JSONL and posts its activity. This captures the true end of the prior session's work even when `/eos` never ran. The developer reliably runs `/sos` when starting work - that's the moment where the prior session's activity gets settled.

---

## JSONL timing slop

The first real `/eos` after PR #764 deployed hit an immediate edge case: Claude Code writes session-start hook entries 5-10 seconds before `/sos` records `created_at` in the database. The original endpoint rejected the entire batch when any event fell outside `[created_at, ended_at]`. The `try/catch` in `/eos`'s backfill path swallowed the 422 silently, so every session's activity write was failing without logging.

PR #765 changed the behavior to per-event filtering. Out-of-window events are dropped and counted in a `skipped_out_of_window` field; the rest of the batch is accepted. The 422 was appropriate as a signal for caller bugs, but wrong as a batch-rejection policy where clock skew and hook timing are routine.

The fix validated against the live session that triggered it: 1,100 raw JSONL events, 1,090 in-window after filtering, 82 unique minute buckets recorded. Session history correctly split a 10.7-hour overnight pause into two blocks.

---

## Two different questions, two different storage shapes

The practical lesson from this build is that heartbeats and activity records answer different questions and should not be conflated.

**Heartbeats** answer: is this session still alive? They're cheap to compute, don't need to be comprehensive, and tolerate gaps - if the agent is doing deep work and doesn't heartbeat for 20 minutes, that's expected behavior, not data loss.

**Activity buckets** answer: when was this session active? They need to be comprehensive - every minute of real work should produce a record. They're derived from a transcript that records everything, not from a signal that fires only at specific lifecycle moments.

Trying to answer the second question with the first instrument produces the flat-span problem. The session store already had `last_activity_at` as a field - updated on heartbeat - but that's still a lifecycle event, not a per-minute log. The JSONL transcript is the right source because it records what the agent actually did, not when the agent happened to call a specific tool.

For any system that needs to reconstruct when work happened - calendar sync, billing, capacity planning - per-minute activity from the transcript is the foundation. Heartbeats are a complementary liveness mechanism, not a substitute.
