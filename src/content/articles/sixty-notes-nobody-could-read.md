---
title: 'Sixty Notes Nobody Could Read'
date: 2026-10-14
description: 'An audit found 60 saved agent memories reachable from no index at all. The notes were fine. The delivery tier they were wired into was the defect.'
author: 'Venture Crane'
tags: ['agent-context', 'agent-operations', 'testing', 'observability']
draft: false
---

Saving a note for an agent and an agent reading that note are two different guarantees, and only one of them is easy to check. An audit of one venture's durable memory store found sixty memory files that were referenced from no index at all. They had been on disk for weeks. Nothing had read them, and nothing in the system was capable of noticing that nothing had read them.

The notes themselves were not wrong. They included standing directives from the Captain about how to operate in that venture, and two records of routine commands that print secret values to the transcript if invoked the obvious way. The information was correct, current, and completely unreachable.

## Every layer looked healthy

The failure mode is worth describing precisely, because it produced no symptom anywhere.

The files were present on disk. The index file parsed without error. Sessions started clean. Any check anyone would naturally write, on any single layer, would have returned green. What had actually happened was that an earlier compaction of the always-on index deleted rows to make room instead of moving them into an archive index. The pointer was not stale. It was gone, and a memory nothing points at is a memory that no longer loads.

No instrument had ever been asked the one question that would have caught it: does the index still reach everything in the store.

That question is a reachability question, and it has to be computed transitively. The index points at sub-indexes, which point at further files, and a file is reachable if any chain of links gets to it. The audit that shipped walks that graph and reports orphans, dangling rows, the attic count, and the index's remaining headroom.

One design call carries most of the weight. Reachability follows markdown links only, and deliberately ignores the loose cross-references that memory bodies use to refer to each other. Following those would make nearly every file reachable from nearly every other, which produces a check that cannot fail, which is the same as no check.

The same instinct closed two false positives found against the real store. A memory body mentioning another file in prose, and a memory quoting a file URL as an example of a clickable path, were both being read as real references. Each was fixed at the pattern with the incident that produced it recorded alongside. A check whose noise is indistinguishable from its findings gets switched off by the person it is supposed to help.

## Two thresholds, and three wrong measurements in one day

The index has two limits, and conflating them caused three separate wrong conclusions in a single day, twice by one agent and once by a critique agent auditing that agent.

| Threshold          | Value        | On crossing |
| ------------------ | ------------ | ----------- |
| Hard read limit    | 24,985 bytes | fail        |
| Recommended target | 17,510 bytes | warn        |

All three measurements had used a flat 25,000 taken from a changelog line. One of them reported 5,131 bytes free when the real headroom against the operating target was 179.

The audit now reports headroom against the target, not the read limit, because the target is the number that should change a decision. The target warns and exits zero rather than failing, on the reasoning that a soft cue which breaks the build gets disabled, and a disabled check is worse than a noisy one.

## A silent guard and a guard that never ran look identical

The audit was registered to run at session start and to speak only when it has something to say. That is correct signal hygiene and it created the second defect, found the same day while testing the first fix.

A clean run and a hook that never fired emit exactly the same output: none. Measured against the real store, the session-start block printed output from an unrelated hook and nothing at all from this one, and nothing anywhere could separate "392 of 392 reachable" from "never executed." The guard had the failure mode it was built to detect.

The fix is a receipt. Every hook run stamps a small file beside the store, and a wiring flag reads it. Two details make it actually work.

A manual run deliberately does not stamp. Proof that a human can produce output by running the tool demonstrates that the tool works, not that the wiring fires, and those are different claims.

And the receipt alone would be circular, because a hook that stops running also stops updating its own receipt. The non-circular witness is the session transcript directory, which the harness writes per session whether or not any hook runs. A session that started after the last receipt is a session the hook did not serve. The comparison uses the transcript's creation time rather than its modification time, because a live session appends constantly and modification time would flag every healthy session as a failure.

Run before the fix, the wiring check reported that the session-start hook had never recorded a run across 31 session transcripts, and exited non-zero. That was the true state. A real headless session start then produced a receipt under its own process id and the check went green. The instrument was proven by being run against the broken state, not by being reasoned about.

## Thirty two bytes from repeating the original incident

The third finding that day was arithmetic. The always-on index was sitting 32 bytes under its target. The next row added to it would have forced a compaction, and compaction is precisely what deleted sixty rows the last time.

Reclaiming space meant moving title-only rows into sub-indexes with their annotations intact, not deleting them. That distinction was not stylistic. A search run first showed that 16 of the 18 candidate rows were pointed at by the top-level index alone, so deleting them would have reproduced the original incident inside the fix for it.

The compaction claim was then falsified on a copy of the store: removing one of the re-homed rows dropped reachable from 392 to 389 and flipped the result to failing. A cleanup that cannot be shown to break when done wrong has not been shown to work when done right.

## Built and not wired, inside a change about silent failure

Code review on the original change caught five issues before merge. The important one: the audit had been registered in the doctrine registry as the enforcement mechanism for a law while nothing actually invoked it. A change whose entire subject was detecting silent failure had shipped a detector that nothing called. Two review agents found it independently.

The immediate fix was to register it as a session-start hook. The structural fix was the one that matters: the doctrine integrity test now asserts that every enforcement pointer naming a file under the hooks directory also appears in the harness settings that actually run hooks. That assertion was falsified by unregistering the hook and watching the test go red, which is the only way to know an assertion is doing work.

## A review date with no instrument reads as a criterion being met

The index had pre-registered its own experiment: on or after a named date, check whether any of the eight recorded traps recurred now that their lessons sit in the always-on tier, and build a delivery hook only if they did. There was a date and a decision rule, and nothing that counted recurrences and nothing that fired on the date.

Building the counter surfaced the most useful finding of the day. Its first draft passed its own self-test, then scored 1,217 encounters and 1,124 stumbles across 32 sessions of history. Two rules were defective. One latched on the first edit to a Python file and then counted every subsequent Python invocation, producing 1,128 encounters that drowned the other seven traps. The other had a remedy pattern that could never match, so all 58 of its encounters scored as stumbles, which would have handed the scheduled review a predetermined verdict of recurred before anyone looked.

A check that cannot pass is as empty as one that cannot fail. After narrowing both rules, the counter read 120 encounters and 34 stumbles across all history, and every ratio corresponded to an incident a memory had actually been written about.

The counter also had to separate two things that look alike. An encounter is the trap condition appearing in tool output. A stumble is an encounter where the documented remedy did not follow. A pull request left behind by a sibling merge is not a failure; one that an agent answered by re-running the merge command instead of updating the branch is. Counting encounters would have reported the tier failing every time it succeeded.

## The rule

Test the read path, not the write path. A memory system is only as good as its worst delivery guarantee, and the write side is the side that is easy to verify and easy to feel good about. Ask whether an index still reaches the store, ask whether the checker itself ran, and get that second answer from a witness the system writes regardless of whether your checker is alive.

Then run any new instrument over real history before trusting it. A green self-test proves the logic can distinguish its two cases. A run across known history proves the thresholds are calibrated to the world. Those are different checks, and the first one will pass cheerfully while the second one is wrong.
