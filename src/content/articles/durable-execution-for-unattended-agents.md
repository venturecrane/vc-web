---
title: 'An Agent Should Write the Script, Not Be the Loop'
date: 2026-06-21
description: 'When an agent task burns money, the reflex is to make the run survivable. Often the real fix is upstream: the agent should write the script, not be the loop.'
author: 'Venture Crane'
tags: ['agent-operations', 'costs', 'architecture', 'agents']
draft: false
---

We asked an agent to do something trivial: read about forty inbox items and add up the amounts. It cost around fifty dollars and produced nothing. The useful part of that story is not how we made it survivable. It is that we killed it - late, and a little lucky.

That framing matters, because the obvious lesson is the wrong one. The obvious lesson is "long agent runs need durable execution, so build a substrate that checkpoints and resumes." We almost learned that lesson. It would have been a mistake, because it answers a question we should never have been asking.

## What actually happened

The agent ran the task as a single conversation turn. Forty sequential reads, each appended to the context, a running total carried in the history, against a hard reply budget measured in tens of seconds. The turn could not finish forty reads and a sum inside the window, so it timed out. The next attempt started clean - no memory of the reads it had already done - and redid the expensive front half. Then it timed out again. Several attempts in, there was still no total, and the meter was running the whole time.

Read that and the engineer's instinct fires immediately: the run needs to survive. Checkpoint the progress, persist the state, let a worker resume where the last attempt died. Reach for durable execution. The instinct is real and the machinery is buildable, and it is exactly the trap.

## The wrong question, answered well

Durable execution answers "how do we make this long agent run finish?" That is a good answer to a question we had no business asking. Summing forty numbers is not a reasoning task. It is arithmetic over a list. Using autoregressive inference as the runtime for deterministic bulk work is the most expensive way to do it that exists.

An agent reading forty items one at a time, holding the running total in its context window, paying token cost on every step and re-deriving its place after every interruption, is the wrong machine pointed at the job. A five-line script does the same work for free: deterministically, instantly, and without a budget to blow. Making the agent's version survivable would have made a fundamentally wasteful process reliable. That is worse than the timeout, not better, because a reliable waste does not announce itself - it just quietly costs fifty dollars a run forever.

## The principle: write the script, do not be the loop

An agent's value is judgment. Deciding what to do, reading ambiguous input, noticing the one item that breaks the pattern, choosing the next step when the path is not obvious. That is work the model is uniquely good at and a script cannot do.

The moment the work becomes "do the same mechanical thing N times and accumulate the result," the agent has left the part it is good at. The right move is for it to emit code that does the iteration and read back the answer - not to perform the loop itself, token by token, inside its own context. The agent decides _what_ to compute and _how_ to handle the weird cases; generated code does the computing. Be the thing that writes and dispatches the loop, not the thing that runs as the loop.

This is not a niche optimization. It is the difference between an agent that costs pennies and one that costs real money to add up a column, and the two are indistinguishable until the bill arrives.

## A filter you can apply before you build anything

The failure is seductive because the symptom - a long run that keeps dying - looks identical whether the task is legitimately long or fundamentally misshapen. From the outside, "needs durable execution" and "should have been a script" present the same way. So before you build infrastructure to make an expensive agent run reliable, put the task through one question: is the agent the right runtime for this work, or should it be writing code that runs somewhere cheaper?

Three signs the answer is "write code, do not run the loop":

- The work is **deterministic** - same input, same output, no judgment per item.
- The work is **bulk or repetitive** - the cost is in the count, not the difficulty.
- The per-item cost is **trivial in code and nontrivial in tokens** - you are paying inference prices for arithmetic.

When all three hold, durability is the wrong lever. You are not trying to make a long job survive. You are trying to stop doing the job the slow way.

## When durable execution is the right tool

This is not an argument against durable execution. There is genuinely long, unattended work an agent must drive itself - a multi-document review where each step needs a judgment call, a job that legitimately runs for an hour because the reasoning cannot be compiled into a script. That work needs a durable substrate: a record of progress, a worker that resumes across interruptions, the ability to cancel. Building it is correct, and we are.

The receipts task was not that work, and the tell was that every step was mechanical. The discipline is not "never build durable execution." It is refusing to reach for the heavyweight tool on reflex, because the symptom looks the same as the case that genuinely needs it.

## The durable takeaway

We caught the fifty-dollar version late, after it had already burned the money, and stopping it was more luck than process. The discipline we want is to catch it at design time - to ask, before the agent starts, whether it should be doing this work or writing the thing that does it. The most expensive agent failures do not look like bugs. They look like reasonable tasks pointed at the wrong machine, running well enough to bill you and badly enough to never finish.
