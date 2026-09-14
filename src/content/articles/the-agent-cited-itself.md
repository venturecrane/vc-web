---
title: 'The Agent Cited Itself'
date: 2026-09-28
description: 'A provenance gate asked whether the agent read an identifier or composed it, and counted the agent reading its own instructions as reading it.'
author: 'Venture Crane'
tags: ['security', 'agents', 'agent-operations', 'architecture']
draft: false
---

A deployed agent wrote a record identifier into a customer's system of record that it had never read from any customer record. It read the identifier in its own skill file, and the gate built to catch exactly that counted the read as provenance.

The gate asks one question of every identifier in an outbound draft: did the agent read this, or compose it? A register holds everything the agent read this session, and an identifier that appears in the register passes. The answer is only as good as what is allowed to seed that register, and the seeding rule was the action class alone. Every read-class tool result was recorded as a source, and the tool that opens a local file is read-class. So the agent's own files, its skill text, its memory store, and its own scored drafts all counted as sources of record.

On 2026-08-21, during a rehearsal on the customer's deployment, a self-test asked the agent to prove the gate by drafting a note citing a sentinel identifier. The sentinel is named in the skill file. The agent read that file before each attempt. By the time the check ran, the sentinel was in the register and nothing was unverified. The first write failed because the sentinel record does not exist. The agent retried against a real record, and that one succeeded.

No refusal row was written for either call, which is why the ledger was silent. The path that finds nothing unverified emits nothing by design.

## This is not the confabulation problem

An earlier piece here argued that the expensive agent failure is confident undisclosed inference, and that the cure separates disclosure from verification: ground a claim and cite the artifact, or mark it as a hypothesis, but never dress inference as fact.

This failure sits one layer beneath that. The agent did cite. The citation mechanism worked. Every step of the grounding discipline ran, and the machine that decides what counts as grounding returned the wrong answer, because a sentence in the agent's own instructions had been admitted as a record of what the customer's systems contain.

That is the part worth generalizing. Any grounding rule, human or mechanical, rests on a provenance rule underneath it, and the provenance rule is where the interesting mistakes live. An agent quoting its own prompt back to itself satisfies every surface test for citation. The gate was not broken. It was fed a poisoned register.

## A read establishes provenance only when it reaches the customer's records

The fix names the rule in the source. Seeding is now an explicit allowlist of tenant-source read tools, and the check re-derives the action class itself rather than trusting the caller. Everything the deployment holds about itself is excluded, each exclusion carrying its reason in the code:

- its files and skills, and its own session search, which is the incident
- its memory store
- model output about its own composition, including a scoring tool that hands a draft straight back
- self-description and run metadata: seat facts, connector status, job status, escalation state
- credential metadata from the connectors
- its own unsent drafts, with the distinction stated: a committed record in the customer's system is the customer's record and still seeds, while a draft is only the agent's own sentence
- an echo tool that returns its input, which is the case that rules out any rule based on tool-name families
- the open web, which is a source but not the customer's, and is writable by anyone who would like a number believed

The direction is the safety property. An unclassified read tool does not seed, so a newly added tool makes the gate over-report, which produces a refusal a person clears, rather than under-report, which produces a write nobody catches. A pin test enumerates every read tool and asserts membership on both sides, so a new tool cannot join either list without someone deciding which.

## Subtraction alone would have loosened the gate

Removing the agent's own reads from the register is subtraction, and subtraction by itself makes a gate weaker rather than stronger. The draft path carves out an empty register, because refusing an identifier when there is no source to re-read leaves a person with nothing to do about it. Before the fix, local file reads meant the register was almost never empty. After it, a turn whose only reads were local has an empty register, and every composed identifier on that turn would have been allowed with a report row. The sentinel would have walked through the carve instead of through the register, and whether the verification test passed would have depended on whether an unrelated connector read happened to run first.

So the agent's own reads are not discarded. They are recorded in a second register that means the opposite thing. An identifier that the seat-text register verifies and the source register does not is seat-sourced: the empty-register carve does not reach it, the call refuses, the audit row records the source as the seat's own text, and the refusal message says the value appears in the agent's own instructions rather than in any record.

"Nothing was read" and "this came out of your own instructions" are now different states. Both are refusals, and only the second one can tell a person what went wrong.

## Three neighbors found in the same read

Reading the gate end to end to fix one defect surfaced three more, and they are the reason a narrow fix would have been the wrong output.

The two tools that carry the customer's real documents were never scanned at all. Each puts its payload under a key that was absent from both scan lists, and neither tool was marked as requiring a body, so the check matched nothing and returned without an opinion. Documents reached the customer's file with no identifier check whatsoever. Worse, a later read of those same documents seeded every number in them back into the register as though it had been read from the record. An unchecked write followed by a read is a laundering loop: composed values acquire provenance by being written down.

Those two tools now report rather than refuse, per tool, and never through the global mode lever that downgrades an entire deployment. The reason is a prior finding rather than timidity. The last time a gate began refusing that class of content before anyone had measured its false-positive rate, the agent removed the flagged figures from a document so the document would stage. A gate that cannot be satisfied honestly teaches the model to satisfy it dishonestly. Flipping those two to refuse is a decision to make with the false-positive number in hand, and the audit row records which posture produced it, so a reader can tell a two-tool report mode from a deployment somebody switched off.

The audit ledger was also describing the incident wrongly. The row for the write that landed on a real record said the internal write had been routed to a draft folder, on a branch that performs no routing. An internal write that executes must not be described in the record as a draft.

And the skill's own wording caused the live write. The step said to create an internal draft note, and the model resolved that to a tool that writes to the customer's system of record. A self-test must never prove a refusal by writing to production, so the step now proves it with a draft in a channel where the agent can clean up after itself, and a test asserts both the presence of the draft tool and the absence of the three writing tools.

## The proof came before the fix

The regression test was written first and run against unmodified main, where it failed twice, in the two ways worth having. The first failure is the incident: a local file read seeded the register and the sentinel verified. The second is the order-independence the negative register buys: the same body with no connector read first, where the empty-register carve would otherwise have allowed it outright. A third case passed on both sides, the control where the same identifier is seeded from a genuine record read, which is what keeps the fix from being a gate that simply refuses more.

Afterward, a real drafting run on a separate deployment staged a document with real figures and produced zero unverified hits, while the same scan path emitted refusals on a different tool in the same window. That last detail is the point of the observation: a quiet instrument and a dead instrument look identical unless something else it watches is firing at the same time.

## The rule

Provenance for what counts as a source must exclude the agent's own instructions, its own memory, and its own prior output. An agent that can cite itself can manufacture a fact by writing it down, and every grounding discipline layered on top inherits that hole silently, because from the inside the citation looks complete.

The corollary is about what a gate should do when it has nothing to work with. Refusing with no explanation and allowing with no explanation are both unusable. Keep a record of the reads you rejected as sources, so the refusal can name where the value actually came from.
