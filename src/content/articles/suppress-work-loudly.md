---
title: 'Suppress Work Loudly'
date: 2026-06-14
description: 'When a suppression mechanism fails, the failure mode should produce more work, not less - because silent suppression looks identical to a successful decision.'
author: 'Venture Crane'
tags: ['agent-operations', 'reliability', 'agents', 'architecture']
draft: false
---

Suppressing work is fine. Suppressing work silently is not. The difference lives in one branch of error handling that is easy to get backwards.

We hit this while building a suppressed-wake audit into the cron-driven scheduling layer of an agent system. The pattern is straightforward: a cron tick fires, a gate evaluates whether the agent actually needs to wake for this run, and if not, the gate records the decision and exits. The record is the point - you need to know that a real decision was made, not just that the agent was quiet.

The naive implementation suppresses the wake and writes the audit record in the same code path. If the audit write fails, the naive implementation suppresses the wake anyway and returns cleanly. You end up with a quiet agent and no record of why, which is indistinguishable from a successful suppression.

## The Inversion

The fix is to invert the fallback. When the audit write fails, fall back to waking the agent rather than staying quiet.

This feels counterintuitive. The whole point of the gate was to avoid unnecessary work. Now we're saying a broken gate produces work. But consider what you're actually optimizing for. Silent suppression is not the same as correct suppression. If you cannot record that the decision was made, you have not actually made a reliable decision - you have created a blind spot that compounds every time the gate fires without a record.

Wake-on-audit-failure is the conservative, recoverable choice. An agent runs when it might not have needed to, and you see it in your logs. The alternative - suppression without record - is undetectable until you need the audit trail and discover it was never there.

## Where This Pattern Applies

Any mechanism that can suppress, defer, or skip work has the same failure mode. The audit-write failure is one instance of a general class.

**Rate limiters.** A rate limiter that fails open (allows all requests) is a known failure mode people design against. But a rate limiter that fails closed (blocks all requests) without logging the block is equally problematic. You have no way to distinguish "the rate limiter protected the downstream system" from "the rate limiter broke and stopped all traffic." Both look like silence.

**Cron guards and idempotency checks.** A cron job that checks whether work is already in progress before starting a new run is a good pattern. If the check fails and the guard suppresses the run silently, you lose the run entirely. The guard should fail toward running, not toward skipping.

**Request filters and circuit breakers.** A circuit breaker in the open state is supposed to fast-fail requests and let the downstream recover. But if the circuit breaker itself has a fault - a state-read failure, a bad configuration reload - and it fast-fails everything silently, you cannot distinguish a circuit-breaker decision from a circuit-breaker bug. The breaker should emit on every open-state decision, and its own failure mode should route to an observable path.

**Memory eviction and context pruning.** Agent systems that prune long-running contexts before an inference call can silently drop content if the eviction logic hits an error and exits cleanly. The pruned content never reaches the agent, the agent does not know what it did not see, and the record shows a normal run. Eviction failure should surface as a run-time error, not as successful eviction.

## The General Principle

Every suppression mechanism is a circuit-breaker variant. And circuit-breakers have a known design rule: the failure mode of the circuit-breaker should not look like the happy path of the circuit-breaker.

Silent suppression violates this rule. A suppression gate that fails closed looks exactly like a suppression gate that succeeded. You cannot tell them apart from outside the system, and often you cannot tell them apart from inside the system either unless you are specifically looking at the right metric.

The corollary: when you are building a mechanism that can suppress work, the mechanism's failure mode should produce more work, not less. More work is observable. It shows up in logs, in dashboards, in downstream systems that receive requests they did not expect. You can investigate. You can fix.

Less work that is unrecorded looks like a decision. It is not.

## What We Changed

The fix in our case was a single condition in the error handler. Before: audit write fails, return the suppressed-wake response. After: audit write fails, fall back to the wake path and let the agent run normally. The agent logs its own activity, so a fallback wake produces a record even if the explicit audit record did not.

We also added a distinct error state to the audit schema so a failed-write can be distinguished from a never-attempted write when we review the audit log later. A fallback wake is useful, but a fallback wake that reads in the log as "normal scheduled run" is less useful than one that reads as "gate failed, woke as fallback."

This came out of the same refactor where we moved per-item fetch loops inside code-execution blocks for token efficiency. That work cut context overhead significantly across several agent tasks. But the suppressed-wake audit is the more structurally significant one - not because the fix is complex, but because the naive version is exactly wrong in a way that looks correct.

The low-friction cases are not always the safe ones.
