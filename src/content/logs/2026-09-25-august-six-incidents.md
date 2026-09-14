---
title: 'August in review: six incidents'
date: 2026-09-25
tags: ['agent-operations', 'observability', 'security', 'infrastructure']
draft: false
shipped: 'A send-reconciler and an out-of-process send broker; a dispatch-shape guard on every registered tool handler; a refusal pager and a provenance seam for pre-run reads; a root-side gateway liveness supervisor with heartbeat fields and five alert conditions'
---

_Retroactive log covering August 11-24, 2026, published September 25, 2026. Reconstructed from merged pull requests, incident records, and session notes._

Six incidents in fourteen days on the customer-installed agent product. Five of the six were found by a human, not an instrument, and that is the through-line.

## August 11: a message with no audit row

A message left a seat's mailbox with no corresponding row in the audit log. Every governed path was ruled out by name, so something holding the mailbox API key had called the send endpoint directly. The vendor stores no provenance on sends, so the actor was never identified.

The defect is not that a key can send mail, which is no different from a password. It is that the audit log could not answer whether the deployed agent sent it, which is exactly what the security overview promises a customer.

Transmit moved out of the agent process. A broker now holds the send credential, checks recipients against the seat's authored counterparty surface, and writes the audit row itself before answering. A reconciler now compares each seat's sent folder against its audit log under a read-only key minted for the purpose.

## August 13: the only send tool raised on every call

The runtime dispatches tools with arguments in the first positional slot. The handler took keyword arguments only, so every call raised a type error before any transport ran. It had never delivered a message, and it was the single send path for both mail transports.

Three defects, not one: the signature, the payload read (a signature-only fix would have sent an empty message and still reported success), and a fallthrough defaulting an unconfigured seat to a mailbox nobody provisioned. The test could not catch it because it called the handler by keyword, the shape it was mistakenly written for. The test agreed with the bug.

A guard now asserts every registered handler accepts the dispatch shape, and was shown to fail against the unfixed handler before it passed. The transport test asserts the message body, not the call count.

## August 13: the work was done and nobody was told

A request arrived by email, the deployed agent read all fifteen documents on the record and filed the requested document correctly. Then it told nobody. Its reply was drafted and held by a content gate, on two figures it had read off the customer's own documents that session and cited to their source.

A prior fix had given those figures a provenance-scoped exemption on one path. The reply path does not supply that register, so one path over, the gate still forbade what the skill permits. Worse than the hold, the skill's authored recovery never fired.

Nothing landed. The issue was filed rather than patched, under scope discipline.

## August 19: the escalator could not get past its own gates

A routine woke with one item needing attention, a deadline seven days out, and made five send attempts. All five were refused, once on a punctuation marker and four times by the identifier gate on date values. The next day it woke with five items and made no attempt at all.

The mechanism is a read with no seam to record itself through. The pre-run script reads authored dates in a subprocess and the runtime injects its output into the prompt as text. Nothing seeded the provenance register from it, so inside the turn a date that arrived as prompt text is indistinguishable from one the model composed. The gate was correct.

This was the third newly shipped gate in a month to silence the same routine on the same path, and each of the three was correct. What was missing every time is that from outside a seat, refused, did not try, and nothing to report produce the identical observation. Three things landed: a handoff file giving the pre-run read a seam, refusal counters on the heartbeat with a pager, and a rule that a new refusal gate on an outbound path is not done when its unit tests pass.

## August 20: thirty-three minutes of silence behind a green check

The gateway's event loop stopped on a paying customer's seat, mid go-live. The runtime has a backstop that probes the loop and hard-exits after three misses so a supervisor can restart it. It logged that it was exiting. It did not exit.

Underneath sat the defect nobody knew about. The seat's only host health check queries a handler returning a literal constant, in a separate process that was never wedged, and it answered successfully every thirty seconds throughout. The heartbeat and the dead-man ping come from that same process, so they stayed green too. The one condition that would have caught it was disarmed by configuration for go-live.

A root-side supervisor now watches the loop heartbeat, escalates through three signals, and bounds itself with a kill ledger so a flapping seat pages instead of restarting forever. It was proven by reproducing the incident on the old image and not on the new one.

## August 24: the fix had been running dead for two days

The daily digest arrived with every item unnamed, and three defects were stacked behind it.

The handoff seeding shipped two days earlier had never bound in production: the writer ran under one home directory and the reader searched another, a path that has never existed on the seat. Every morning's handoff was written perfectly and read by nothing. The refusal message itself then offered the degraded path, suggesting the unverified value be removed and marked as needing confirmation. The model complied, and the fourth attempt passed with every line reporting the identifier as unavailable.

The class is merged green, inert in production. Both handoff tests passed because writer and reader shared a temporary directory, and no test ran them under the environment split the runtime has. The refusal pager fired correctly on the first three attempts. Nothing measured the fourth, the one that passed.
