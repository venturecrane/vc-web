---
title: 'Long-Running Agent Work Needs a Substrate, Not a Longer Prompt'
date: 2026-06-21
description: 'An agent task that exceeds a single turn budget needs durable, resumable, cancellable execution: a job ledger and a segmented worker, not more context.'
author: 'Venture Crane'
tags: ['architecture', 'agent-operations', 'costs', 'agents']
draft: false
---

A single conversation turn has a budget. It has a wall-clock reply deadline, a context window that fills, and a token bill that climbs with every tool result appended to the history. Most agent work fits comfortably inside that budget. Some does not. The failure mode when an unbounded task meets a bounded turn is specific and expensive, and the fix is not a longer prompt or a higher timeout. It is a durable execution substrate underneath the agent.

We hit this directly. A multi-tenant agent platform was asked to do something mundane: read roughly forty inbox items and total the amounts. That is not a hard reasoning problem. But the agent ran it as one synchronous turn, against a hard 55-second reply budget. The turn could not finish forty reads, summaries, and a running total inside the window. It timed out, and on the next attempt it restarted from zero - no memory of the reads it had already done. That task burned around fifty dollars and delivered nothing. The cost did not come from the difficulty of the work. It came from doing the same expensive front-half of the work over and over, never crossing the finish line.

## Why a Long Task Cannot Be One Turn

The instinct is to treat this as a tuning problem: raise the timeout, trim the prompt, batch the reads. Those help at the margin and miss the structure. A synchronous turn is the wrong container for any task whose natural runtime exceeds the turn budget, for three independent reasons.

First, the deadline. A reply budget exists because something upstream is waiting on the response - a webhook, a mailbox, a request handler. You cannot extend it indefinitely without breaking the thing that called the agent.

Second, the context window. A task that processes forty items accumulates forty items' worth of intermediate state in the conversation history. Even if the deadline were infinite, the window is not. The history grows until the model is reasoning over a transcript that is mostly bookkeeping.

Third, and most damaging, the absence of resume. When a turn dies, a fresh attempt starts with no record of what the previous one accomplished. There is no checkpoint to resume from, so the only behavior available is to redo everything. That is what turns a forty-dollar timeout into an open-ended bill: not the cost of the work, but the cost of repeating the work's beginning indefinitely.

The lesson generalizes past inbox-totaling. Anything that exceeds a turn's natural budget - a multi-document review, a long batch of enrichment calls, an unattended job that must run to completion while no one watches - has the same shape. It needs durable, resumable, cancellable execution. The agent's reasoning is fine. The container is wrong.

## What the Substrate Actually Is

The substrate is designed around four parts, and none of them is a new persistence engine. The principle was to lean on primitives that already existed rather than build a general durable-execution framework. The control plane - the ledger and its safety invariants - is built; the in-process worker loop that drives it is the remaining integration work, and the design below is what that loop is being built against.

A **job ledger** is the control plane. It is a single mutable row per job in a broker-owned store, recording exactly the facts the agent's conversation history cannot hold: status, the rotating session tip to resume from, a lease for crash recovery, accumulated cost, the delivery target, and a reference to the result. The conversation itself lives where it already lives - in the agent's append-only session store. The ledger holds only the control facts that store cannot. A second table records idempotency keys, so a step that has a side effect can be marked before it runs and skipped on resume rather than fired twice.

An **in-process worker thread** advances jobs in segments. This is the part that matters most, the easiest to get wrong, and the piece still being wired in. By design it is not a new replicated process and not an async task on the request-handling event loop. It is a background thread inside the gateway that already runs scheduled work, reusing the same agent-construction path the cron scheduler uses. The loop is deliberately simple: claim a job, resume the conversation from the recorded tip, run one segment of work, record what it spent and where it left off, and repeat. The job advances across many segments and many turns, so no single segment has to fit the whole task inside one reply budget.

A **result store** holds the output. The artifact is written to per-customer object storage (Cloudflare R2) before delivery is attempted, so a host reschedule mid-delivery cannot orphan a completed result.

**Status and cancel verbs** make the job observable and stoppable. A `start_background_job` verb returns a ticket inside the reply budget without waiting for the work. A `job_status` verb reports state and the result reference. A `job_cancel` verb sets a flag the worker checks at every iteration boundary, so a runaway job can be stopped without killing the process.

## The Properties That Make It Safe

Durability is not just "save the state." A few invariants do the real work, and they are worth stating because they are the parts a naive version omits. Some already live in the control plane; others are properties the worker loop is being built to guarantee.

Cost is enforced pre-spend, by design, from real provider-reported usage, at the per-tool-iteration boundary. After each tool result is appended, the worker recomputes the projected cost of the next request and hard-stops if the job would exceed its budget. This is the direct antidote to the fifty-dollar failure: a job carries a budget in cents, and the budget is checked before the next expensive call, not discovered after the bill arrives. It also produces the first real per-job cost measurement, which is its own kind of valuable.

Lease fencing prevents double execution. Each claim mints a monotonically increasing epoch, and every privileged write to the ledger carries it. A worker that was presumed dead and respawned-but-not-actually-dead finds its writes rejected as stale. Two workers cannot both advance the same job, and they cannot both deliver the same result.

Side effects are journaled before they happen. The idempotency key for a step is recorded before the step runs, not after. If the process crashes between recording and acting, the resume sees an in-progress key it cannot resolve and parks the job for review rather than guessing. Fail-closed beats double-send.

## When You Need This, and When You Do Not

This is not a pattern to reach for by default. Most agent tasks finish in a turn, and wrapping them in a job ledger adds machinery that buys nothing. The substrate earns its complexity only when a task genuinely exceeds the turn budget and must complete unattended.

The clean signals are: the work is long enough to time out a synchronous reply; it must survive a crash or a host restart without redoing completed work; the cost is high enough that repeating the front half is a real bill; and the result needs to be retrievable later rather than returned inline. A multi-document review fits all four. Inbox-totaling, it turned out, fits them too - not because it is hard, but because forty sequential reads exceed the budget and a restart that loses progress is ruinously wasteful.

The pattern is overkill when the task fits in a turn, when there is no unattended requirement (a human is watching and can retry), or when the work is high-volume and better served by a purpose-built batch pipeline than by a long agent run.

## The Durable Takeaway

When an agent task runs over budget, the reflex is to make the turn bigger - more time, more context, a tighter prompt. That treats the symptom. The turn is a container with a fixed budget, and some work does not fit. The right move is to put a substrate underneath the agent: a durable record of each job's state, a worker that advances it in resumable segments, a result store, and the verbs to check and cancel it. The reasoning stays in the agent. The duration, the survival, and the delivery move below it. A task that cannot finish in one breath should not be asked to hold its breath - it should be allowed to take many.
