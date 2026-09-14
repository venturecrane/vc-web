---
title: 'September in review: new pipeline, decommission, two more incidents'
date: 2026-09-29
tags: ['architecture', 'agent-operations', 'infrastructure', 'process']
draft: false
shipped: 'A document-drafting pipeline built as a driver over a frozen legacy implementation, metered and capped per paid call; the decommission pipeline given five real backends; a drifted safety control enrolled as a tracked cross-repo pair; two overlay reverts; two incidents recorded'
---

_Retroactive log covering August 27 to September 11, 2026, published September 29, 2026. Reconstructed from merged pull requests, incident records, and session notes._

A document-drafting workload a person used to run by hand became a pipeline this window, and nothing about the working implementation was rewritten.

## A driver over a frozen pipeline

The legacy scripts were frozen at a vendored commit and left alone. What shipped around them is a driver.

A graph module states the fixed stage order as code, with each stage's argument contract and exit-code map. The driver executes that list; it does not decide order at run time. It runs the frozen scripts as subprocesses, skips stages the state file says are done, and stops at the first hold or failure with one word and one reason. State is per unit and written atomically, so a kill mid-stage resumes there rather than from the top.

Live spend is read incrementally from the run ledgers and priced at read time from a dated rate card, because a remembered price list is how a stale figure gets into a skill. Tokens are canonical, dollars derived. A stage that loses its environment still writes, to an orphan file, and the recording call never raises: losing a measurement is a defect, losing the work being measured is a bigger one.

A later change moved the meter. The unit became pages rather than documents, because a document is not a unit of work: delivered packages ran from a single page to several hundred. The month's debits had counted delivered jobs only, so a run that spent real money and then held left no mark. The cap was advisory, so anything that could author a job envelope could author its way past the customer's posture. Enforcement moved from per stage to per paid call, because one long stage could run well past the cap before anything looked. Hold reasons name the setting that held them and carry no dollar figure.

The last slice closed the loop back to a person: a request arriving by email becomes a job, and a terminal or held job composes a wake task and posts it back to the seat gate, at-most-once, because a duplicate is worse than a loss.

## Decommission, and a control that had drifted

The decommission pipeline was built fail-closed on purpose: a live run refused while any destructive backend was a stub, and for months that refusal was its only protection. A seat retirement in late August was done by hand across four layers.

Five real backends landed, each the inverse of provisioning and of what the account actually holds, listed read-only beforehand rather than assumed. Object storage deletes by prefix and never touches the retention archive the preceding step just wrote; the vector indexes, seat mailbox, host application, and observability rows each have an implementation that is idempotent when the thing is already gone. The refusal now names the credential each missing backend needs.

A safety control existed in two copies, and the proposal was to retire the local one as unwired. The other copy's own header settled it the other way: it is vendored from this repository, and changes land here first. The local file had drifted seventy-one lines behind what every seat runs, with nothing pinning the two. It is now a tracked pair, checked in both directions.

## Two reverts

A boot probe shipped to prove that a runaway brake was still wired. Its loader derived the audit plugin's path from the handler's own location, which is the repository layout, not the installed one. On a real seat that path does not exist, the gateway refused to serve an ungoverned agent exactly as designed, and a staging seat crash-looped. The pin was reverted rather than fixed forward, because customer seats were healthy but one reprovision away from the same hazard.

Two hours later the second revert abandoned the self-check entirely. Across three attempts it had accumulated three broken lookups, a wrong harm tier that crash-looped a seat for twenty-nine minutes, and a severity that paged as fatal on a condition its own log text calls benign. Every one was a defect in code written to verify code, with no client better off than at the moment the brake was connected. A control whose failure modes exceed the failure it detects is a bad trade.

What stayed is the mission: the two brake arms that had sat implemented, thresholded, audited, and unit-tested for months with no caller in either repository are now fed. The registry rows moved to unprobed, the true state.

## Two incidents

On September 1 a seat restarted itself every fifteen minutes for two and a half hours, and nothing on it was broken. The gateway builds its channel directory as the loop's first task, resolving every platform plugin with a synchronous module load on the loop. On a small instance with a cold cache that took about four minutes. The liveness watchdog is armed before that work begins and its budget is about two minutes, so it tripped and hard-exited. The host replaced the container, the next boot was colder and slower, and nothing in that circuit damps. Neither mechanism was wrong; their budgets were incompatible.

The same day a breaker tripped correctly on a production seat and the resume bypassed its own governance surface. Inbound mail drove turns that passed record numbers where the connector expected identifiers; three not-found errors in one burst made the client-side circuit declare the server unreachable, and the ladder counted its way to a hard stop.

The operational half is worth keeping. The responder concluded no wired clear surface existed and cleared the stop with a raw database update. The surface existed in full, endpoint, library, admin route, and a visible form; the false conclusion came from two truncated searches. The raw clear left the governance table silent, a resume the audit trail cannot see, against a written commitment that all changes are logged.
