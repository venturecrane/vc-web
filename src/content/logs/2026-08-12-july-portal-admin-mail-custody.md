---
title: 'July in review: portal, admin, and mail custody'
date: 2026-08-12
tags: ['architecture', 'agent-operations', 'infrastructure', 'process']
draft: false
shipped: 'The admin console rebuilt on a five-destination spine with the lead-gen-era analytics surface retired; a portal form-kit sweep closing the last reachable unmigrated surfaces; a mail-custody channel for one major corporate mail platform built parallel to the incumbent path; two incidents recorded, one delivery and one commitment'
---

_Retroactive log covering July 3 to August 12, 2026, written September 14, 2026. Reconstructed from merged pull requests, incident records, and session notes._

The admin console had grown by accretion. Every feature that shipped got a word bolted onto the top nav, and by mid-July the nav was nine words, three of which were the corpse of the retired lead-generation machine.

## Five destinations

The rethink started from one observation: the admin console is the same object graph as the client portal, viewed from the other side. A client sees their engagement, their agent, their billing. The operator of the business sees the same things across every client, plus an operational view a client never needs.

Nine nav words became five. The chrome came into parity with the client portal: the admin badge dropped, the nav lifted out of the header row into its own band with section anchors and an active tile, and settings demoted from a product line to an account affordance beside sign-out.

The review that produced this was a walk of every surface, and it was blunt. One destination tried to be both delivery status and the commercial spine, and its own page carried a drift banner admitting it reconciled nothing. Billing encoded a false assumption, every deployment worth the same hardcoded amount, because no real per-engagement pricing existed behind it. The client roster had no way to add a client and columns that meant nothing.

Execution went one surface at a time. The analytics surface was retired in full, a dashboard measuring a pipeline that no longer existed; only the read dashboard died, the capture pipeline survives. The client roster became one flat list of every business being worked, each row badged with its lifecycle stage, plus the add-client form that closed the gap. A mislabeling fix went in with it: the detail page had been hardcoding client language and a green status dot onto records that had never signed anything, a fabricated-content violation on a surface read to know where things stand.

## The form-kit sweep

On the portal side, the sweep finished a rule the design system had been carrying since its adoption: every reachable surface with form controls renders through the kit. The pending list shrank from thirteen to five, and the five that remain are unlinked editor field components, left by design. The kit grew to cover what the sweep actually found rather than what it had anticipated: multi-line text, multi-select, checkbox options, several input types, and a filled primary submit tone.

One section was deleted rather than restyled: zero consumers, and its own header admitted its write was a no-op.

## Mail custody

The larger July decision was about where the deployed agent's mail lives. For any customer whose agent handles confidential correspondence, the recommendation is now that the agent's email identity is a dedicated mailbox on the customer's own mail system, with the third-party mailbox service unbound for that seat. One mail path, one custody story.

The unit of the decision is the customer's email system, not any single provider. The architecture must not couple to one vendor the way it had historically coupled to the incumbent service. One major corporate mail platform is the first adapter, with the exact analog scoped for the other and a generic fallback for the corporate tail at reduced fidelity.

Four pull requests built it over two days. The seam specification locked six decisions, including inbound by delta-query polling with a self-healing cursor rather than a public webhook endpoint, and a normalized message shape at the gate seam that the incumbent provider migrates onto as one adapter among several. The connector shipped with six tools on flat argument surfaces, pinned to a single mailbox and scoped tenant-side to that mailbox only, with no delete tool and no tool that accepts a mailbox parameter. The configuration layer added a provider-neutral send identity. A staging seat bound the whole thing end to end.

The fourth pull request is the interesting one. The live-fire run found the connector baked into the image and never launched, because it had no registry entry. The seat could receive and had no tool to reply with. The fix was a pin bump, and the finding is the recurring one: built is not wired.

The invariant that came with the decision is structural. Every inbound message from every provider and every future channel passes the same trust machinery before it can influence the model, and a channel that cannot be routed through it is not a channel that gets bound.

## Two incidents

On July 28 an epic closed green and the act it existed to deliver was impossible. Four pull requests shipped against it, each individually honest, one of them stating in its own body that later slices were unbuilt. The artifacts summed to less than the feature. The structural half is that the acceptance-criteria machinery parses the merging pull request's own status table, so a slice that declares itself met is what closes the epic. What landed is a narrow merge gate blocking any pull request that marks a runtime criterion met without a recorded verification id, plus a planning contract that enumerates the gates backwards from the act a real customer performs.

On July 31 an output-provenance audit established that a seven-day snooze promise could not hold. The escalation ledger keyed each item on a hash that included a model-composed label, so the same obligation arrived with a new identity every day: 86 fired events produced 83 distinct keys, and only five ever recurred. Acknowledging an item snoozed a key that would not exist tomorrow. The audit was emphatic that the token store itself was sound, 88 rows and 88 recomputed matches with no collisions, and that rebuilding it was the wrong remediation. The general rule that came out of it is now structural: values are projected by code and the model composes prose around them, never the reverse.
