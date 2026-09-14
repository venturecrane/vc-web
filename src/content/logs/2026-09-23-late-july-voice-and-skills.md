---
title: 'Late July in review: voice and skills'
date: 2026-09-23
tags: ['architecture', 'agents', 'agent-operations', 'methodology']
draft: false
shipped: 'An authorship model in which every output class declares its voice, format, gates, and delivery; the post-hoc sample-transform mechanism retired; a read-in-place document bridge kept and repointed; four manual-initiation drafting skills behind ten mechanical gates'
---

_Retroactive log covering July 30 to August 1, 2026, published September 23, 2026. Reconstructed from merged pull requests, incident records, and session notes._

The word voice named two unrelated mechanisms in one codebase, and the confusion between them cost a working session and produced a build that fed the weaker one.

## Two mechanisms, one word

The first mechanism is spec-primed authorship. An agent reads the customer's own writing and produces a written specification: named traits with verbatim exemplars, plus precedence rules that subordinate voice to accuracy. That specification enters the drafter's context and the model writes with it. A prove-out graded it and found seven of eight traits modulating by audience as specified, the voiced arm 24% shorter than the control at budget parity, and one case where the voice protected accuracy by declining a false total the control asserted.

The second reduces documents to content-free structural fingerprints, aggregates them into a numeric profile, and applies that profile as a post-hoc rewrite of four surface properties. Fully automated, no authoring step.

Three findings settled it. Everything the second mechanism can change, the first also controls, and controls with some understanding of what the document is doing rather than by pattern-matching a finished draft. The second was measurably broken for the document type customers actually supply: run against the rehearsal corpus through the real differ, all five sample letters returned no greeting style and no signoff style, because the vocabulary has no formal-letter register. Two of its four levers were dead, and the cheap fix was unsafe, since the existing template would have rewritten a customer's letters into a register they do not use. And neither mechanism was wired on a seat.

## What replaced it

Every output the deployed agent produces belongs to an output class, and each class declares four properties: voice, format, gates, and delivery. Each is authored by the customer or fails closed to the persona's own authored judgment. None of the four has a vendor-chosen default.

Two authored voices, both the customer's. The persona voice is the agent speaking as itself, authored with the customer as part of the persona, needing no customer documents, so it exists from day one. The customer voice is the customer speaking with the agent holding the pen, derived from their own documents read in place, available once the corpus has been read.

Format turned out to be a separate axis, and a binary one where voice is probabilistic. A model writes in a register and someone grades whether it sounds right; typography either complies or does not. The customer's own authored drafting standards were almost entirely format, and none of it should be produced by a model. So critical format is not: the model fills content into a structure, and code owns typography and required elements.

A correction now has a concrete mechanism. It is an edit to that output class's property, auditable, visible in the portal, surviving restarts, applying identically to every subsequent run. Consistency is the point. An output that honors a requested shape most of the time is worse than one that never claimed to, because the reader stops trusting it and re-reads everything.

Three pull requests carried the work. The portal relabeled its landing block from voice to persona, reserving voice for the customer's own, and ripped out the inert chrome underneath: an endpoint that only logged intent, a section mounted nowhere, a stub returning an empty list, and the composite loader carrying it, which had zero callers. A coverage slice added three read-only views to existing surfaces, including an authority block that renders the persona's authored exposure map in plain sentences and leaves unauthored classes unrendered rather than shown as permitted. The read-in-place bridge resolves plain-English document names against the live account, downloads them, extracts text with the connector's own extractor rather than a second implementation, and refuses ambiguity by listing candidates and exiting non-zero. That bridge was kept and repointed at the surviving mechanism.

## Four skills, ten gates

The drafting lane shipped as four on-demand skills, manual initiation only: never scheduled, never triggered by webhook, never chained from a routine. Output is always a draft delivered internally to the person who asked for it.

Behind them is a shared discipline and ten gates derived from evidence, each citing the finding that produced it, plus a mechanical checker with its own 49-test suite covering quote contiguity, question pairing, held-out leakage, an external-document wall, a self-certification ban, coverage diff, and marker visibility. It was validated against real prove-out artifacts with known ground truth: one clean pass, and two true positives on defects a transcript had already confirmed.

Customer seats refuse code execution under the custody guard, so on those seats the checker runs harness-side on the delivery path rather than in the agent process. The lane is fail-closed by omission on the customer seat, with a commented activation block naming the five requirements it has to clear first.
