---
title: 'The Alert That Cried Wolf Daily'
date: 2026-09-30
description: 'A reconciler that scans all history with no memory of what it already reported files the same finding every morning until nobody reads it.'
author: 'Venture Crane'
tags: ['agent-operations', 'observability', 'ci-cd', 'process']
draft: false
---

A control that files a correct finding every morning for a week is not a working control. It is a training program that teaches its readers to close the issue unread, and the day it carries a real leak it will look exactly like the previous thirty.

The control in question compares what left every deployed agent's mailbox against what that agent's audit record says it sent. It exists because on 2026-08-11 a message left a customer deployment's inbox with no audit row at all, and reconciling the whole mailbox found nine of 121 sends unaccounted for.

The defect is worth stating precisely, because the obvious statement is wrong. The problem is not that something holding an API key can send email. That is key possession, and it is no different from a password. The problem is that the audit record could not answer the question "did the agent send this?" That is the question a customer asks in a dispute, and the completeness of that record is what the product offers them.

The actor was never identified. The mail provider stores no provenance on a send: no key id, no source address, no user agent. By elimination it was something holding the key calling the send endpoint directly, most likely internal test traffic from another machine, and the record cannot say more than that.

The control runs off the machine on purpose. A deployment cannot audit its own egress. A send from an inbox belonging to a decommissioned deployment, or to no deployment at all, is exactly what a local check could never see.

## First it was green because it asked nothing

The reconciler was built as a result of that incident, and then it was inert.

Three secrets it needs were absent from the repository's Actions configuration, so every scheduled run since merge hit a hold, exited zero, and went green without scanning a single inbox. On the dashboard, a watchdog that exits zero without observing anything is indistinguishable from a watchdog reporting all clear.

The correction is an exit contract that has three outcomes instead of two: zero is clean, one is findings, two is that nothing was measured. A hold fails the run. Filing nothing is not the same as reporting a pass, and an unevaluated control that goes green is how a watchdog sits dead for weeks.

## Then it was loud every day about the same eleven things

Once it could see, it scanned all history on every run and had no way to acknowledge a send already triaged. A static backlog of pre-fence sends therefore produced a fresh issue every morning, forever. At one point five copies of one finding were open at once, each listing the same eleven items, the newest of which was a deliberate test send planted to prove the control could fire.

The naive fix is a lookback window, and it is wrong. The full-history scan was load-bearing for correctness: scanning everything is what let the triage prove that no new unaccounted send existed, because a new one would have to appear in the same list. Narrowing the scan to quiet the noise would have destroyed the property the control exists for.

What the control actually lacked was memory. It now has two layers of it.

The first is a committed baseline file naming each dispositioned send by inbox and message id. It is updated by pull request, and that is deliberate: the repository takes no pushes to its main branch, so quieting a finding is a reviewed act with an author, not something the control can do to itself.

The second is a fingerprint, a stable key computed over the current set of findings and carried in every issue body. Between the first report and the merge of its baseline update there is a window in which the daily run would file a duplicate. In that window the run recognizes its own open issue by fingerprint and declines to file a copy.

Neither layer can quiet a new send. The baseline names specific message ids, and one new send changes the fingerprint, so a genuinely new finding still opens a new issue.

The falsifier was built in rather than assumed. A deliberately planted unaudited send, absent from the baseline, still raises. Prove a quieted watchdog can still fire before trusting its silence, because from the outside a control that has been correctly quieted and one that has been broken produce identical output, which is none.

## A hold is interim or it is not a hold

The third turn of the screw came a month later, from the same control, and it is the subtlest of the three.

A later phase of the job verifies the body of each send against the copy in the mailbox. A send dispatched before its inbox crossed a particular deployment boundary has no counterpart to verify against, and nothing anyone does can ever produce one. That case was being graded as a hold, which fails the run.

The result was eleven scheduled runs in a row failing on one historical send, and seventeen critical notifications, with nobody acting on any of them. A red that cannot be made green is the same defect as a daily duplicate wearing different clothes: it consumes the attention budget and returns nothing actionable.

The rule that came out of it is short. A hold is interim or it is not a hold. A hold means "the control could not evaluate, and might on a later run." A condition that can never resolve is a grade, not a hold: it is now counted, printed indented, and never fails the run. The neighboring case where a deployment has simply never stamped a send yet still holds, because there the counterpart may yet arrive.

## Coverage is part of the same discipline

The last finding was scope. Until recently the job read one mail channel and covered none of the deployments on the other, including the customer whose mail lives in its own corporate tenant and never touches the first channel. The control was quiet about those deployments in a way that read identically to clean.

It now reads both channels, and each deployment on the second channel needs its own read credential, so the reconciler holds loudly until it has one. A test asserts that every authored deployment on that channel is named in the workflow's secret list, which means a newly provisioned deployment cannot be added without wiring the credential that makes this control cover it.

## The rule

A reconciler without a baseline is a noise generator. The alert budget is finite, it is spent per message rather than per finding, and every duplicate spends it on something the reader has already decided about.

That sits alongside a rule this team argued for earlier, that a mechanism which suppresses work should fail toward producing work, because silent suppression looks exactly like a successful decision. Both rules point at the same constraint from opposite sides. Suppression must not be silent, and loudness must be rationed by novelty. The two are compatible only if the rationing is done by a durable, reviewed record of what has already been dispositioned, rather than by narrowing what the control looks at. Shrink the scan and you buy quiet by going blind. Add a baseline and you buy quiet by remembering.

The test that keeps that honest is the planted finding. A control with memory has to be able to prove, on demand, that its silence is a measurement rather than an absence.
