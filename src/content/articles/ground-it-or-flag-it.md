---
title: 'Ground It or Flag It: Ending Agent Confabulation'
date: 2026-06-23
description: 'The agent failure to fix is not guessing - it is confident, unmarked inference dressed as fact. The cure separates disclosure from verification.'
author: 'Venture Crane'
tags: ['agent-operations', 'process', 'methodology', 'agents']
draft: false
---

An agent explained how one of our systems worked. It produced a clean answer: a table of components, a description of the data flow, the request states each layer handled. No hedging. Under a few questions the explanation collapsed - the components were plausible inventions, the flow was a guess, and the files that would have settled it had been on disk the whole time. The agent had not lied in the sense of knowing the truth and stating otherwise. It had generated a hypothesis from priors and presented it in the costume of established fact.

That is confabulation, and it is the single most expensive agent failure mode we deal with. The fix is not the obvious one. Most people reach for "make the agent stop guessing." That target is wrong, and aiming at it produces agents that are either useless or no more reliable than before.

## The Disease Is Not Guessing

Generation-from-priors is the substrate a language model runs on. You cannot switch it off, and you would not want to. Forming a hypothesis from incomplete information is most of what makes an agent useful: it proposes a likely cause for a bug, a probable shape for an API, a reasonable next step. An agent that refused to form hypotheses until it had read everything would never start.

So the disease is not inference. The disease is **confident undisclosed inference**: a hypothesis presented as a fact, with the surface markers of authority - a table, a citation, zero "I think" - and none of the grounding those markers imply. An explanation of your own system is twenty factual claims wearing a trenchcoat. Each one feels, from inside the generation, exactly like recall. That is the trap. Pattern-completion from training and retrieval-from-evidence are indistinguishable to the model producing them. The felt sense of "I know this" is not a reliable signal, and it is _least_ reliable precisely when the agent is confident and wrong.

This is why the common advice - "verify when you're unsure" - fails on the cases that matter. It delegates the decision to a confidence signal that is broken in exactly the expensive scenarios. The agent that is about to state something false does not feel unsure. It feels certain. Routing verification through felt-certainty means the worst errors never trigger it.

## Two Mechanisms, Not One

The cure is to stop treating this as one problem. There are two separable mechanisms, and conflating them is why most attempts fail.

**Disclosure is free and universal.** Never present inference as fact. When the agent is below the threshold where reading or running is worth the cost, the cure is not silent confidence - it is a marked hypothesis. "My read, unverified: the count probably comes from the paginated slice." That sentence costs nothing. It carries the same useful hypothesis, stripped of the false authority. The target disclosure eliminates is the _middle_: confident, unmarked inference. That middle should not exist anywhere, ever, regardless of stakes. It is pure downside - the reader inherits certainty the agent never had.

**Verification is rationed by stakes.** Reading a file or running a command to upgrade a hypothesis into a cited fact has a real cost - tokens, latency, attention. You cannot pay it on every claim. So verification is spent where the blast radius justifies it: claims that drive a decision, claims about what is deployed where, and the highest-damage class of all, claims about how your own systems work.

These map onto a single operating rule: **ground it or flag it - never dress inference as fact.** Either pay the verification cost and cite the artifact, or mark the claim as a hypothesis. The one path that is forbidden is the third one everyone defaults to: assert it as fact and move on.

## The Class Where Disclosure Is Not Enough

For most claims, disclosure carries the load. A flagged hypothesis is honest and cheap, and the reader can decide whether to push for grounding.

But there is a narrow class where flagging alone is insufficient, and it is worth naming precisely because it is the class that burned us. When the claim is about **how our own system works** - architecture, data flow, what a component does - the agent's felt-certainty is itself the broken instrument. This is the home turf of pattern-completion. The agent has seen a thousand systems shaped like this one, so it generates the most likely shape and feels sure. The confidence is real and the grounding is absent, and disclosure depends on the agent noticing the gap. On this class, it reliably does not.

So for this class the rule hardens: you do not get to assert, and you do not get to flag. You produce the artifact or you say nothing. The first action on a question about system behavior is a read, not a sentence. Answer with `file:line` or command output, or answer with "checking." There is no honest middle, because the signal that would let the agent flag its own uncertainty is exactly the signal that is broken here.

This is a class-gated citation rule, and the gating matters. Requiring a citation for every claim would be paralysis. Requiring it for the narrow class where felt-certainty is structurally unreliable is the right amount of friction in the right place.

## How This Differs From Adjacent Failures

Two related failures are worth separating out, because the cure here is distinct from both.

One is the briefing that lies - bad _inputs_. An agent can be handed context that is itself wrong (a count that reads "10" when the real number is 270) and reason faithfully from it to a false conclusion. That is a data-integrity problem upstream of the agent.

The other is failing to read at all - the agent that opens vendor docs when the answer was already in the codebase. That is a sequencing problem: the right source existed and went unconsulted.

Confabulation is neither. The inputs can be clean. The read can be cheap and one tool-call away. The failure is what the agent _emits_ in the gap before the read: unmarked inference shipped as fact. You can read your own codebase first and still confabulate on the next question. The separation of disclosure from verification is what closes that specific gap - it makes the dressing-up itself the prohibited act, independent of whether the source was available.

## Making It Fire in the Moment

The hard part is that this has to fire _before_ the claim is emitted, not as a retrospective correction after someone pushes back. Telling an agent to "verify before opining" does not work, because that phrase is a feeling, not a test. The agent reads it, agrees, and confabulates anyway - nothing in it forces a behavioral interrupt.

What works is a concrete, testable question the agent must answer before asserting: _can I name the source?_ File path, command output, URL, a line in a doc. If yes, state it and cite it. If no, the claim is inference - flag it, or for the gated class, say "checking" and go read. "Can I name the source?" is testable in a way "am I sure?" is not. It converts an unreliable feeling into a mechanical check, and it moves the metacognition - am I retrieving or generating? - to the front, before the sentence exists.

The grounded miss is also cheaper than the dressed-up one. "I gave you an unverified answer; here is the grounded version" closes the loop in one turn. The confident-then-corrected pattern - assert, get challenged, "discover" the truth in two files you could have read first - burns a full cycle and erodes trust every time.

## The Durable Takeaway

Confabulation is not a guessing problem to be solved by making the agent guess less. It is a _disclosure_ problem with a narrow _verification_ carve-out. Generation-from-priors stays on, because hypotheses are useful. What gets eliminated is the costume: inference wearing the markers of fact. Ground it or flag it. For the narrow, high-damage class where the agent's own certainty is the broken signal - how your systems work, what drives the decision - flagging is not enough, and the rule is the artifact or silence. Get those two mechanisms separated, and the worst version of agent confidence stops shipping.
