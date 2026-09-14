---
title: 'Handing a Decision to a Human Needs a Real Acknowledgment'
date: 2026-09-03
description: 'An escalation ending in "reply with this code" is empty unless the code names a stable item and the reply names a verified person.'
author: 'Venture Crane'
tags: ['agents', 'agent-operations', 'architecture', 'process']
draft: false
---

When an autonomous agent escalates, the last mile is a person replying with a code. That exchange looks trivial and it carries the whole weight of the handoff: it is what stops the alarm, what records that somebody decided, and what a customer is later shown as proof the decision was made. Getting it wrong does not produce an error. It produces a system that looks like it is working.

Ours was wrong in four distinct ways, found in that order, and each one had a fix that the previous round's design made possible.

## Round one: a ledger, and a promise that was inert

The first build gave the escalation path an append-only ledger with per-item state: fire once, re-fire only after a configured interval, and treat an acknowledgment as a snooze for a bounded window rather than a tombstone. The ledger belongs to a privileged broker process rather than to the agent, so the agent's turn appends only through a validated seam and never touches the file. The broker refuses an acknowledgment whose token has no prior raise on the same item, which is what stops an injected reply from silencing an alarm that never rang.

All of that was correct, and all of it was inert.

An output-provenance audit traced the chain end to end and found that the item key hashed a label the model composed in its turn. The pre-run step assigned a label from a closed set; the agent then invented a descriptor for that run. Same underlying obligation, two different hashes. The audit's count: 86 raise events produced 83 distinct item keys, and only five keys ever recurred. Every obligation therefore arrived as a new identity every day. Acknowledging one key snoozed that key, and tomorrow it was a different key, unacknowledged, and it fired.

A later measurement on the live deployment made the size of it unambiguous: 160 ledger events produced 128 derived item states, of which zero matched any real open item, while 37 real open items carried no ledger state at all. Fire-once and the snooze window were both dead, and every acknowledgment code ever emailed named a phantom entry rather than a real obligation.

The audit was emphatic about one thing, and it is the part most likely to be gotten wrong by whoever fixes this next. The token store was correct and must not be rebuilt. Eighty-eight token rows, 88 recomputed matches, zero collisions. One item that led an alert on one day and was folded into a group three days later carried the same code both times; only the prose around it was recomposed. The defect was the input to the key, not the derivation of the code. The obvious remediation, replacing the token mechanism, would have discarded the one component that was working.

## The write-back that did not exist, and the reason not to build it quickly

The audit found something larger than the identity defect in the same pass. The acknowledgment was never written back to the customer's system at all. Traced end to end, the chain contains no write of any kind. A negative probe over the customer's tenant found the acknowledgment codes appearing only on the agent's own scratch record, and on no customer record anywhere.

The instinct is to add the write-back that afternoon. That would have been worse than the absence.

Even with a write-back, the person who confirmed could not have been recorded. Three independent blockers: the append schema declared a fixed set of properties with no field for an actor, the replying sender was tested only as a yes-or-no roster check and then discarded, and the connector's authorization mode means every write lands under whoever originally authorized the application. A write-back built the obvious way would have satisfied the letter of the customer commitment while producing an affirmative false record, saying one person confirmed when another replied.

A confirmation is exactly the fact a dispute turns on. So the ordering was made explicit: capture the verified replying sender on the acknowledgment event first, then write the confirmer as content, and never lean on the connector's own created-by field, which under that authorization mode cannot be right for any customer with more than one person on staff.

## Round two: identity from stable fields, and an epoch

The key now derives from record identifiers and the authored date, with no model-composed input. The label parameter survives and is deliberately ignored, so the two repositories that both compute this key did not need a lockstep signature change.

The more interesting half is the epoch. Raises written before the change were keyed by the old derivation and can never name a live item, so the validator refuses an acknowledgment against a pre-epoch raise by name. Without that, a person replying with a code from an old alert would be told the item was acknowledged while the real obligation kept firing, which is the same false-report class the fix exists to end. A row whose version field is missing or unparseable is treated as pre-epoch, because unknown provenance is not evidence of a current key.

What that round did not close was stated in the merge rather than glossed. After dropping the label, twin records representing one obligation still mint different keys. Collapsing them needs a rule for what makes two records the same obligation, and two same-day records on one item differ only by their source identifier, so collapsing on the pair of record and date would destroy legitimate distinct items. That is a judgment call, and it stayed open rather than being guessed.

## Round three: the identity is typed exactly once

The tool had two modes that described one item, and nothing connected them. A derive call hashed the components it was given and returned the key and token without writing. The append call re-derived from whatever tuple it was handed on that call. So the code quoted to the person comes from the first call and the ledger row is keyed off the second.

Derive one record, quote its code in the email, append a neighboring record, and the row carries a different code. The person types a code the ledger does not hold, and in a batch it can resolve to a different open item and silence the wrong obligation. Both calls are individually well-formed, so nothing in the tool, the broker, or the ledger could detect it.

Two plausible fixes were rejected for reasons worth keeping.

Having the append echo the derived key alongside the components, and refusing on disagreement, catches a transposition and nothing else. A turn that re-reads the wrong row copies every field off that row consistently, so the comparison agrees and the wrong row is written. That is a control which passes exactly when the failure is worst.

Having the append return the code it wrote is cleaner and inverts an ordering that is load-bearing. The code must be in the person's hands before the row is written, because a failed send must record nothing, or fire-once silences an item nobody was told about.

So the binding runs the other way. The derive call mints a single-use handle for the identity it just derived, bound to the skill and the event kind, and short-lived. The write presents the handle and no identity components at all. Supplying any component is a refusal rather than a silently ignored argument, which is what closes the copies-the-wrong-row case. There is no second derivation, so the divergence is not detected. It is unrepresentable. The invariant is small enough to state in one line: the identity components of a ledger row are typed exactly once, ever.

The residual is stated plainly rather than papered over. The tool never sees the email. A turn that derives one item, quotes its code, then derives a second and writes that one still writes a row the person's code does not name. What is gone is every case where the append could name a different item than the derive that produced the quoted code. The remainder is governed by an authored rule that the agent never prints a code a tool did not return this run, and by the confirmation reply enumerating what was acknowledged, not by a tool invariant.

## Round four: the ledger learns to hold a person

The customer was told every confirmation is logged with the name of the person who gave it. The ledger had no field to hold a person, so an acknowledgment recorded that somebody quoting a valid code had confirmed, and threw the identity away.

An acknowledgment event now accepts an optional confirmer, refused on every other event kind. Both halves are required together: a bounded display name and a 64-character hex identity key. A name with no key is an unjoinable assertion about a person, and a key with no name cannot be written into something a human reads.

The broker validates the payload rather than trusting it, even though the caller resolves the value from a signature-verified webhook origin. This is the evidence behind a customer-facing commitment, and the broker is what would still refuse a malformed payload from any other caller.

A separate hardening round in the same cluster fixed the state fold. A raise now clears acknowledged, resolved, and handed-off together. The live defect it fixes: a blocker went raised, then resolved, then raised again, and folded to a permanently released state, so the routine planned straight past a re-surfaced problem. Terminal states are terminal until the alarm rings again. Release events with no prior raise on the same key are refused the same way acknowledgments are.

## The rule

An acknowledgment is a claim about two things: which item, and which person. If either half is composed by the model, derived twice, or dropped on the floor, the acknowledgment is decoration, and the system will keep reporting that decisions are being made.

The corollary is the sequencing. When a commitment is unmet, building the visible half first is the tempting move and usually the wrong one. A write-back with no verified actor would have turned a missing record into a false one, and a false record about who decided is worse than an empty one in exactly the setting where anyone will ever read it.
