---
title: 'The Watchdog That Announced a Restart It Never Performed'
date: 2026-09-24
description: 'A supervision mechanism that logs its intent and then fails to act is worse than no supervision, because the log reads like recovery in progress.'
author: 'Venture Crane'
tags: ['agent-operations', 'observability', 'infrastructure', 'agents']
draft: false
---

On 2026-08-20 an agent deployment stopped answering for 33 minutes, with every health light green, and came back only because a person restarted it by hand. Twenty-three minutes into the silence its own liveness watchdog fired and wrote, verbatim, that the event loop had missed three consecutive probes, that it was dumping all thread stacks, and that it was exiting with code 75 so the service supervisor could restart it.

It did not exit. There was no service supervisor. The process id was the same before and after the watchdog's announcement, and it changed only when a human sent the interrupt, sixteen minutes after the watchdog's announcement.

A watchdog that does nothing fails honestly: you get an outage, you investigate, you find no supervision. One that logs a recovery it does not perform converts a transient hang into an unbounded outage and hands the operator a sentence that reads like healing.

## What the evidence actually supported

The first filing named three causes, and reading the source at the exact revision the deployment was running contradicted all three. The corrections are more useful than the original guesses, because each wrong cause would have sent the next reader down a different dead end.

The filing said the exit needed to be made unconditional. It already was. The watchdog thread calls the hard process exit directly, with no graceful shutdown path, so the theory that a clean shutdown needed the very loop that had wedged cannot be the mechanism. The thread reached its critical log line and never reached the exit two statements later. Between them sit exactly two calls, a thread dump and a state write, and which of the two stalled was never established, because the evidence to establish it is gone.

The filing said a promised stack dump was missing, citing a zero-byte file. That file is written only in response to a signal nobody had ever sent, so its emptiness was correct behavior rather than a broken diagnostic. The watchdog's own dump goes to standard error, and never landed there either.

The filing cited an exit-diagnostics file as proof the exit never happened. It cannot prove that. A hard exit bypasses the hooks that write that file, so a successful watchdog exit writes nothing to it either.

The conclusion survived all three corrections, resting now on the one artifact that carries it: the process id.

## Every instrument was disarmed, three of them by construction

The defect the filing did not name is why nobody knew. The only external health check on that deployment was an HTTP handler that returns a hardcoded success constant. It observes nothing about the agent, and runs in a separate process that was never wedged.

Two more signals rode that same healthy process: the control-plane heartbeat and an external dead-man ping. Both stayed green for the same reason. A fourth instrument, a fleet alert on overdue scheduled work, would have caught this, except that the deployment's scheduled jobs were turned off for the go-live.

Three instruments could not see the failure by construction, and one was disarmed by configuration. A check that cannot fail has measured nothing, and three of these could not fail whatever the agent did.

One detail is contested and stays that way. The original filing reports the platform health check as critical throughout, while the log buffer shows that handler answering successfully every thirty seconds across the same window. The platform keeps no check history to settle it, so the incident note records the discrepancy rather than picking a side.

## Recovery has to come from outside the process

The fix is structural rather than clever. The agent runtime we build on already writes a loop heartbeat from a task running on the very loop that wedges, so the file goes stale the instant the loop freezes. Nothing was reading it.

A supervisor now runs as root in the container entrypoint, forked before the privilege drop, in the same shape as one that already covered a sibling process. It reads that heartbeat, and on two consecutive stale samples it escalates: a diagnostic signal, a grace period, a re-check so a loop that recovered is never killed, then terminate, then kill. The container exits non-zero and the platform replaces the machine.

Three guards exist in that loop because a probe found each one. The heartbeat is not where the runtime's own source says it is, so its path is derived from the running process's arguments rather than by picking the most recently modified directory, which identifies the right one only while things are healthy. One deployment runs a revision predating the heartbeat entirely, so there "no heartbeat ever appeared" means the build has none, and the supervisor goes inert and loud rather than killing.

A kill ledger on the volume caps restarts at three per hour. A deployment flapping every four minutes is not better than one that is down. It is the same outage plus churn, and it destroys in-flight work each cycle.

The tests drive the real supervisor loop, extracted from the shell script, against a fake process tree, rather than grepping the script for the right strings. A grep-only guard would have passed against the exact defect that opened the issue.

## The loudest state has to leave the machine

Part one made a wedged agent restart itself. It did not change the fact that every signal a human could see still said healthy, and that the supervisor's own alarming states lived only in platform logs nobody was tailing.

So the supervisor writes a one-word state on every transition, the surviving webhook process puts the loop's pulse age and that state word on the control-plane heartbeat, and the alerting worker pages on five conditions. Two signals rather than one, because one would be racable: the restart that fixes the problem is also what refreshes the heartbeat, and on the proving run it landed inside the window where an age-only alert could have been overwritten before the sampling cron read it. The kill ledger is the event record a restart cannot race.

The external health check stays a constant by decision: a failing platform check stops routing to the machine, trading a bounded outage for an unbounded one whenever the reading is wrong.

## Proving it on a deployment nobody was paying for

The proof ran on an internal deployment pinned to the same runtime revision as the customer's, in three parts.

The baseline reproduced the incident on the pre-fix image: the loop frozen for 340 seconds, the process id unchanged, no restart, and the health endpoint answering successfully 98 times across the window. Without it, a pass after the fix would prove only that nothing was wrong that day.

Part one, on the new image: wedge at 05:54:12, container exit code 137, new agent process by 05:59:17, nobody involved. The arming latch held, in that a stale heartbeat from the previous boot did not trigger a second kill.

Part two measured the whole loop with no human action after the wedge. Wedge at 08:04:30, loop-wedged alert at 08:08:39, self-restart at 08:09:39, restarted alert at 08:10:39 read from the kill ledger, recovered notice at 08:26:39. The page arrives about four minutes after the wedge and roughly a minute before the restart it was meant to precede, which is the ordering the two-signal design exists to guarantee.

The negative control ran fleet-wide: the four deployments not carrying the change reported null for all four new heartbeat fields and opened zero alerts. That is what separates "these alerts come from the change" from "these alerts come from somewhere."

The customer's own deployment was deliberately never wedged. It was rebuilt onto the fixed image and probed, and its supervisor reported armed with a small heartbeat age. Wedging a live customer for a checkbox is not worth it when an identical pre-state exists.

One live defect surfaced only because of that exercise. The kill ledger created by the earlier build carried a file mode that denied read access to the process reporting the state, so that field shipped absent rather than wrong. The entrypoint now converges the mode on every boot, and the boot smoke test reads the files as that process, falsified on a real deployment: exit 1 before, exit 0 after. A permission set once at creation is not a permission, because the next boot creates the file again.

The honest limitation is the recovered notice, which can lag the real recovery by up to fifteen minutes because the reporting process withholds the age field for a window after its own restart. Safe direction, since it cannot produce a false all-clear, and longer than it needs to be.

## Then the supervisor collided with boot

On 2026-09-01 a different deployment restarted itself every fifteen minutes for two and a half hours, and nothing on it was broken.

The agent runtime builds its channel directory as the event loop's first task, resolving every platform plugin through synchronous module imports performed on the loop. On a single-core machine with one gigabyte of memory and a cold page cache, that took about four minutes. The runtime's own watchdog is armed before that crawl, and at its pinned defaults its budget is about 120 seconds. A loop cannot answer a probe from inside a synchronous import. Startup killed itself, the platform replaced the machine, and the next boot had colder caches and a recovery journal to work through, so it was slower than the one that just failed. There is no damping term anywhere in that circuit, which is why it sustained with no external load at all. It was not an out-of-memory kill, and the code shipped that evening was not implicated.

Both new instruments were running. Neither paged, for two separate reasons.

The supervisor never arms on a boot that was never healthy. That latch is correct: persistent storage means a stale heartbeat from the previous boot is on disk at every cold start, and arming on it would kill every boot forever. But not-arming had no deadline of its own. An agent that wedges during startup never writes a first beat, so the supervisor sat in that branch permanently while its state word stayed "not armed", which the alerting path does not page on and must not, since that is also every healthy deployment's first thirty seconds.

The one alarming line it did emit was false. The supervisor is forked while still root, and the entrypoint then hands off to a bootstrap script that runs for minutes before its own handoff to the agent. For that whole window the container's main process legitimately looks like the bootstrap script, and the old code called that inert, a paging state meaning nothing automatic will follow. Every healthy boot produced the alarm, which is the cheapest possible way to teach everyone to ignore the signal.

The correction is that the clock decides. Inside a bounded startup grace the supervisor reports that the agent is starting; past it, inert. A boot that produces no fresh heartbeat inside that grace reports never-healthy and pages, and deliberately does not kill, because killing a slow-starting agent is the mechanism that sustained the loop. There is no recovery action a supervisor can take against "startup is too slow", so the correct output is a person.

## The rule

Verify that a watchdog acts, not that it logs. An in-process recovery path can be blocked by whatever blocked the process, so recovery has to come from outside it, and the test that proves it has to run the recovery rather than read it.

Two corollaries fall out of the same incidents. A health check that returns a constant is not a health check, and one running in a process the failure cannot reach is measuring the wrong thing. And a supervisor's own states have to be legible off the machine, including the states where it decided to do nothing, because "watching and quiet" and "not watching at all" are invisible from the outside.
