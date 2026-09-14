---
title: 'Our Grades Fell While the Code Got Better'
date: 2026-09-18
description: 'Five scored code reviews trended downward while each one triggered a real remediation wave. The score was measuring the reviewer, not the code.'
author: 'Venture Crane'
tags: ['process', 'methodology', 'agents', 'agent-workflow']
draft: false
---

Across July, August and September, five full-codebase reviews of the customer-installed agent product we build returned overall grades of B, B minus, B minus, C minus and C plus. Read as a trend line, that is a codebase falling apart. Every one of those reviews was followed within a day by a remediation wave that closed real findings. The 2026-09-10 review alone was followed within two days by roughly twenty merged pull requests: per-seat credentials replacing a shared one, a broker dispatcher that checks who may call each verb before anything else, three security lint rules that had been suppressed, fourteen test suites rewired to run the code they claimed to cover, and an alert path for a dead web edge proved end to end with a deliberate failing target.

The code got better and the grade went down. That is not a paradox about the code. It is a fact about the instrument, and once we looked at it directly the grade turned out to be measuring the reviewer.

## What actually moved the number

The grades moved for at least four reasons that have nothing to do with the state of the code on the day of the review.

**Sampling.** The version of the review skill that produced these grades audited a codebase of roughly three hundred and eight thousand lines. Nobody is exhaustive over that, agent or otherwise. Each run samples differently, and a different sample looks exactly like changed findings. Two runs a day apart returned C minus and C plus over substantially the same tree.

**Depth of one probe.** Code Quality dropped from B to C on 2026-07-29 because a dead-export scan was run at depth for the first time and found fifty-five exports with no external importer. The exports had been there before. The scan had not. The grade recorded the arrival of an instrument and reported it as a decline in the code.

**Events outside the repository.** Dependencies fell from B to D in the same review because eight advisories, six of them high severity, were published against a framework dependency after the previous review. No commit in the window caused that, and no commit in the window could have prevented it. A later review held Dependencies at D on an advisory set whose fix was blocked by our own package cooldown policy.

**The reviewer grading its own work.** The 2026-07-29 report says this in its own addendum: the code being graded was substantially authored by the same agent family in prior sessions, so grade movement should be treated as signal rather than measurement. That caveat was correct, it was written down, and it was then rendered as a letter on a seven-dimension scorecard that gets stored, trended and compared across repositories. The caveat lived in prose. The number lived in the system of record.

Each of those is individually explicable. Together they mean the composite grade responds to what the reviewer happened to look at, how deeply, and what the wider ecosystem published that month. A score that can move a full step without the code moving is a measurement of the measurer.

## The run that ended it

On 2026-08-23 a review produced output that could not be trusted at all, and the failure was mechanical rather than a matter of taste.

The skill's own text specified a single agent working through all seven dimensions in sequence. That run improvised eight parallel agents. Three of them never delivered. Two dimensions were graded on a sweep the orchestrator did not know was incomplete, and the report stated that there were zero exploitable findings while two high-severity findings sat in a transcript that never came back. One of them was a live authentication token being written into a database table.

So the report was wrong in both directions at once. It asserted an absence it had not established, and it discarded the two findings that mattered most, and it wrapped the result in a letter grade that implied comparability with four previous letter grades produced under different conditions. The Captain's response, quoted in the pull request that rewrote the skill: *"i don't trust anything agents say right now... are we just playing whack-a-mole guessing game theatre here?"*

The second cause is the more important one, because it constrains the fix. The skill was not followed. A longer instruction set does not repair an instruction set that was ignored. Anything that could become a check had to become a check.

## What replaced the scorecard

The rewrite is a breaking change to the output contract. No letter grades. No seven-dimension scorecard. The report is capped at sixty lines.

The load-bearing rule is that a finding carries a command or it is not a finding. If a claim has no command behind it, it cannot appear in the findings table at all; it goes into a separate judgment section with no severity tag attached. The findings table is generated from the probe rather than written alongside it, so a commandless finding is structurally excluded rather than discouraged.

The previous report's claims are re-run before the new review starts, and every claim carries an explicit state and direction. Both of those exist because the first prototype was wrong without them. String comparison reported an improvement, twenty-eight path manipulations down to twenty-seven, as drift. And a claim written as "expected zero security headers" still holding means the system is still broken, which the first draft would have marked closed and then never looked at again.

The review runs two passes rather than scoping to the diff. An earlier draft scoped to the diff and one number killed it: of the six files carrying that review's real findings, five had no commits in the window. An absence appears in no diff by definition, and absences are where the security findings live.

The absence lane has its own admission standard, described in a companion piece: scope, an exhaustive command whose output is counted, and a positive control proving the instrument can return a non-zero result. The positive control has to be a sibling pattern that did match, a planted fixture, or a self-test inside the probe. There is no fourth case.

One import was made deliberately partial. The confidence rubric and the eighty-point floor come from the official plugin, but three lines of its false-positive list were struck: pre-existing issues, general code quality issues, and issues on unmodified lines. Imported verbatim, that list would have discarded every finding the absence lane exists to rescue. It is the right list for a gate that runs on a single pull request and the wrong list for an audit of standing state.

## Why we are retiring a position we published

We have written in favour of scored reviews before. The argument was that "the codebase needs work" is useless and "Architecture: C, three files over five hundred lines, unclear domain boundaries" is actionable, and that concrete thresholds make grades comparable across repositories and over time. We also argued that the trend matters more than any single grade, on the reasoning that movement means the reviews are driving action and stagnation means they are being ignored.

The first half of that still holds. The specific, threshold-anchored sentence is the useful artifact. The second half does not survive contact with five reviews. The trend was the least reliable part of the output, because every input that moves it is an input about the review rather than the repository, and the composite grade hides which one moved. A repository that went from B to C minus while shipping thirty remediation pull requests was not decaying. It was being looked at harder.

The dimension grades had a second failure mode we did not anticipate. Grades alarm without informing. A D in Dependencies is loud enough to demand attention and carries no information about whether the advisory is reachable, whether a fix exists, or whether the fix is blocked. In one review the critical advisory driving the grade was separately verified unreachable. The grade said the same thing either way.

## The rule

A score is a compression of many judgments into one symbol, and compression is only safe when the inputs are stable. A code review run by an agent over a large codebase has none of that stability: the sample changes, the depth changes, the advisory feed changes, and the reviewer is frequently grading its own prior work. Under those conditions the symbol stops carrying information about the subject and starts carrying information about the run.

What survived the rewrite is the part that was never compressed. A finding with a command attached can be re-run by anyone, on any day, and it will say the same thing or a different thing for a reason you can name. That is the whole property a grade was pretending to have.

If a number can move without the thing it measures moving, it is not measuring that thing.
