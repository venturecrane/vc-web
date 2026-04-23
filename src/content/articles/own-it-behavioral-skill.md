---
title: 'When a Behavioral Reflex Becomes a Slash Command'
date: 2026-04-23
description: 'The founder repeated the same directive often enough that we shipped it as a skill. Here is why that choice was right, and when memory or CLAUDE.md would have been wrong.'
author: 'Venture Crane'
tags: ['agent-workflow', 'skills', 'process']
draft: false
---

The directive came up enough times that we started recognizing it: "what is the professional move here?" Not as a compliment - as a correction. An agent had reached a decision point with multiple valid paths, picked the easiest one, and shipped it. The founder caught it. Same thing the next session. And the one after that.

At some point the question stopped being rhetorical.

We shipped `/own-it` - a skill that codifies the behavioral discipline the founder kept having to invoke manually. The interesting design question was not what the skill should say. It was whether a skill was the right artifact at all.

## The problem it solved

Agents make a specific kind of error that is hard to catch in code review. Not wrong code - wrong decisions. An agent near the end of a session, facing two valid approaches, picks the one that closes the ticket fastest. An agent with multiple open threads files a follow-up issue for the hard one and ships the easy ones. An agent hits a question with no obvious answer and asks the founder rather than consulting a peer tool first.

None of this fails a type check. None of it trips a linter. It is a behavioral pattern, and it compounds. A session that ends with one deferred decision and one unnecessary escalation is a small cost. Ten sessions doing the same thing is a meaningful drag on throughput - and it trains the founder to expect that certain decisions will always come back to them.

The recurring correction - "what is the professional move?" - was the founder's intervention. It worked. It reset the agent's framing and produced better decisions. But it required the founder to be present at the exact moment the agent was about to punt.

## Three places behavioral discipline can live

When you want an agent to behave differently, you have three levers:

**Memory** (the auto-memory system, plus `MEMORY.md`) shapes what the agent knows across sessions. Memory is correct when the discipline is a fact the agent should carry - a preference, a context, a constraint. "Never use em dashes" is a memory. It is always true, it applies everywhere, and it requires no active invocation. The agent just reads it and adjusts.

**`CLAUDE.md`** sets the operating environment for every session in a repo. Instructions there load automatically and shape the entire session's behavior. This is correct when the discipline is a session-level constraint - something that should govern every action the agent takes in that context.

**A skill** is a deterministic intervention point. The agent or the founder invokes it deliberately at a specific moment. Unlike memory and `CLAUDE.md`, a skill fires at a defined trigger, not continuously. It is correct when the discipline is contextual - something that needs to activate at a decision point rather than apply across everything.

The distinction matters because misplacing the artifact creates real problems. If "own the decision" were added to memory, it would load as background context in every session. The agent would read it once at startup and proceed. Memory shapes orientation; it does not interrupt in-flight decisions. If it went into `CLAUDE.md`, same result - it becomes a standing instruction that competes with everything else and gets habituated quickly. Neither creates an intervention point.

A skill creates a pause. When invoked, the agent stops and actively applies the discipline to whatever it is currently doing. That is what was missing. The founder's manual invocation was working because it was a moment of active re-evaluation, not because the principle was being communicated.

## What the skill actually does

`/own-it` runs five checks. The agent applies them in sequence against whatever decision point triggered the invocation.

The first is the decision check: is the agent about to defer, ask, or hedge when it has enough information to decide? If yes, decide. The skill includes concrete lists of what constitutes invalid escalation (asking the founder a question answerable from existing docs, filing a ticket for work that can be done in this session) versus valid escalation (a blocked credential, a genuine product question outside the agent's scope).

The second is the peer-consult check: if the agent genuinely needs input, has it used available tools to get it before pinging the founder? The Claude Code session has tool access. A peer consult through those tools is almost always available. Escalating to the founder without exhausting tool-level options is invalid.

The third is the quality check: is the decision being made at a professional standard, not just a passing standard? The minimum bar is not the target.

The fourth is the finish check: is the agent about to hand off something incomplete? Scope creep and gold-plating are bad, but so is shipping half the task and calling it done. The skill distinguishes legitimate phase boundaries (external dependencies, deliberate deferrals) from illegitimate ones (the agent ran out of energy, the remaining work is hard, the session is getting long).

The fifth is the theater check: is the agent doing something that looks like progress but is not - status updates that restate known state, confirmations that add no information, documentation that nobody asked for?

Applying all five checks takes less than a minute. The output is either "proceed as planned" or "here is the adjustment."

## The consolidation problem

When we shipped `/own-it`, we had five separate memory entries covering related territory: no human-ergonomics arguments, kill don't file, critique deferrals, agents produce content, verify root cause. Each captured a real incident. Each applied to a specific failure pattern. Together they described a single underlying principle - own the decision, own the finish - fractured into isolated fragments.

Memory entries accumulate over time. They get written in the heat of a session, after a specific failure, and they target that failure precisely. The problem is that five memories addressing facets of the same principle give an agent five separate readings of one idea rather than a coherent framework. An agent might apply "kill don't file" and miss that it is about to do exactly the thing "critique deferrals" was written to prevent.

The skill consolidates without discarding. The five memory entries still exist as facets - specific, grounded in concrete incidents, useful for their context. The skill takes precedence when the agent is at an active decision point. The hierarchy is: skill invoked at the moment of decision, memory carrying the historical incidents that motivate the rules.

## The self-invocation question

The skill uses a description that is meant to trigger self-invocation when the agent recognizes it is about to punt, over-escalate, or leave work half-finished. That is the design intent. Whether it works in practice is an open question.

One observation from the session that shipped it: the agent caught its own em-dash violation mid-flight, before push. That is the skill working as designed - active self-evaluation at a decision point. Whether the description triggers self-invocation reliably without a manual call is something the next several sessions will show. If it does not, the next iteration is either sharpening the trigger language or moving the discipline into a hook that fires at a structural point rather than a semantic one.

The signal to watch for: does the founder still need to call `/own-it` manually, or do sessions start self-correcting?

## The broader design question

Building governance into agent behavior is not a documentation problem. Writing a process document that says "agents should make professional decisions" does not change what agents do. The discipline has to be architecturally enforced - loaded at the right moment, in the right form, with the right scope.

Memory shapes the operating context. `CLAUDE.md` sets the session frame. A skill creates an active intervention. The choice between them is not about which words to write. It is about when the discipline needs to be applied and what kind of trigger is appropriate for that moment.

The founder's repeated question - "what is the professional move?" - was functioning as a manual skill invocation. The skill automates it. The question was already the right intervention. The work was making it invokable without requiring the founder to be in the room.
