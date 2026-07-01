---
title: 'Template Gives You Consistency, Not Credibility'
date: 2026-07-01
description: 'Per-vertical content a practitioner respects cannot be stamped from one template. Depth at altitude takes serial authoring through an adversarial critique loop.'
author: 'Venture Crane'
tags: ['content', 'methodology', 'agent-operations']
draft: true
---

A dozen vertical marketing pages for a productized AI service started as one template stamped a dozen times. Each page had the same sections, the same rhythm, the same reassuring verbs, and a different industry's nouns dropped into the slots. They were consistent. They were also generic, and generic is the one thing a domain practitioner detects on sight. So they were rebuilt, one industry at a time, each rewritten from template copy to the actual operational lifecycle of that industry, through an adversarial loop: draft, critique the draft as a skeptical practitioner from that field, rewrite against the critique. This is the account of why that work could not be batch-generated, and why doing it serially beat doing it fast.

It is worth naming the tension up front. A companion piece on [a two-day parallel UI sweep](/articles/product-ui-parallel-sweep) argued that a large build becomes tractable when you land a shared abstraction first and fan out many agents onto it at once. That is true for surfaces built on a frozen seam. It is the wrong instinct for content that has to earn a practitioner's respect. We parallelized thirty UI pull requests in that build; we authored these vertical pages one at a time, on purpose. The difference is not scale. It is where the value lives.

## The template trap is not the fork trap

The [templating architecture piece](/articles/templating-ai-service-across-verticals) is about avoiding the fork: make a vertical a piece of data the core product reads, not a copy of the codebase. That solves a maintenance problem. It does not solve a credibility problem, and it is easy to assume it does. If the architecture lets one product carry a dozen verticals from one manifest, the marketing surface for each vertical feels like it should fall out of the same move: one page template, a dozen manifests, done.

It does fall out that way. The result is a dozen pages that a practitioner reads as marketing. The trap here is not duplication cost. It is that a template propagates a shape, and the shape is exactly the part that carries no domain knowledge. A law page and an accounting page can share every heading and every transition and still both be wrong in the specific way that matters, because the specific thing that matters is not in the shape.

## Altitude is the part the template cannot fill

The rebuilt pages center on a lifecycle walk: one real stretch of the industry's core process, carried start to finish, each step in three lines - what the agent does, what the person does, what happens if the step stalls. Those three lines are a template, and a good one. It is a template for structure. It cannot supply the substance that goes in it, and the substance is where a practitioner decides whether the author understands the work.

The accounting page is the clearest evidence, because the record of its correction survives in the source. The first draft had the agent deliver the e-file authorization and collect the signature in a plausible-sounding order. A critique in the voice of a veteran managing partner caught that the completed return must go to the client for review before the authorization is signed, and that transmission happens only after the signed authorization is in hand, because that is what the federal e-file rules require. The same pass corrected a records request the agent had been "soliciting" from a predecessor firm, when in that profession the client requests their own prior records. It separated tracking a firm-entered deadline from determining whether a return must be filed at all, because the second is professional judgment and the first is not. It de-titled the roles, because a sole practitioner and an enrolled agent are not a "partner" and a "preparer." And it collapsed three overlapping document asks into one list gated on a signed engagement letter.

None of those corrections are visible from the template. Every one of them is the difference between a page a practitioner nods at and a page a practitioner closes. A template stamped a dozen times gets none of them, in any vertical, because the template has no opinion about the e-file rules or who requests predecessor records. Only someone standing at the altitude of the actual work knows the order is wrong.

## Why the critic has to be specific, and why it runs one at a time

The mechanism that produced those corrections is not general review. A generic editor pass smooths grammar and catches marketing language, which is useful and insufficient. What surfaced the authorization ordering was a critic instructed to read as a specific, skeptical practitioner: a partner who has run thousands of these engagements and is looking for the tell that the author has not. The role-play is load-bearing. A skeptical accountant and a skeptical litigator flag different things, and a critic asked to be both at once is neither.

That is also why the work does not parallelize the way the UI build did. The parallel sweep worked because a frozen abstraction made the surfaces disjoint and cheap, so more agents meant more wall-clock progress. Here the scarce resource is not agent count. It is holding one industry's operational reality in focus long enough to draft it, attack it as that industry's veteran, and repair it. Split that attention across a dozen domains at once and the critiques regress to the generic mean, which is precisely the shallow template the exercise exists to escape. Depth is a serial act. The loop tightens on one vertical, closes, and moves to the next, carrying only the grammar forward, never the substance.

## The transferable lesson

When an agent produces many parallel artifacts that each have to be credible to a domain expert - per-vertical pages, per-tenant runbooks, per-client configurations, industry-specific docs - a template is the wrong unit of quality even when it is the right unit of structure. The template gives every artifact the same shape, and consistency of shape reads as competence only to a reader who does not know the domain. The reader who does know it is checking the substance the template cannot hold, and a stamped page fails that check identically across every instance. Depth at altitude comes from serial authoring through an adversarial loop: draft, critique in the voice of the specific practitioner who would catch the tell, rewrite, and only then move on. Reserve parallelism for work whose value lives in a shared frozen seam. Reserve serial adversarial authoring for work whose value lives in the part no template carries. Consistency you can stamp. Credibility you have to earn one at a time.

---

_These vertical pages were rebuilt over one continuous push across an evening and the following day, one industry at a time, each through a draft-critique-rewrite loop with the critique role-played as a skeptical practitioner from that field. The corrections described in the accounting walk are real and recorded in the page source; the lifecycle steps are framed on the pages themselves as illustrative of the shape of the work, not a fixed script, and each pairs with a fail-closed note that the agent surfaces what it found and asks where accuracy is not yet proven._
