---
title: 'Scaling One Product Across a Dozen Industries Without Forking It'
date: 2026-06-04
description: 'A manifest plus an addon directory per vertical lets one AI service span a dozen industries without a separate codebase per client. The templating architecture.'
author: 'Venture Crane'
tags: ['architecture', 'agents', 'product', 'configuration']
draft: false
---

We are building an AI employee product: an autonomous agent that does the connective front-desk work of a small business. The same product has to land in a law firm, an insurance agency, a veterinary clinic, and nine other industries besides. Each of those industries has its own intake language, its own systems of record, its own compliance floor, its own line that the agent must never cross. The obvious way to serve a dozen industries is to build a dozen products, or to fork the codebase per client. We did neither. This is the account of the architecture decision that let one product carry a dozen verticals, and the trap that decision was avoiding.

The trap is forking. The moment you copy the codebase to specialize it for a law firm, you have two products to maintain. Copy it again for insurance and you have three. Each fork drifts. A fix to the core has to be replayed across every fork by hand, and the forks that do not get the fix quietly rot. For a small team this is not a slow death, it is a fast one: the maintenance cost grows with the number of clients, which is exactly the curve a productized service cannot afford. The whole premise of selling the same agent to many industries is that the marginal industry is cheap. Forking makes the marginal industry expensive.

## A pack is a manifest plus a directory

The alternative is to make a vertical a piece of data, not a piece of code. We call the unit a pack, and a pack is two things: a manifest that declares what the vertical is, and a directory of skills and addons that the manifest points at. The core product code does not change when you add a vertical. It reads the manifest and loads what the manifest names.

The first PR in this line did nothing but lock the shape of that manifest. It defined the schema for a vertical manifest and an addon manifest, and it extended the per-customer configuration to accept a pinned vertical and a list of addons addressed as `<vertical>/<addon>@<semver>`. Nothing moved in that PR - no pack was built, no behavior changed. It was the contract that everything after it would build against. That sequencing was deliberate. When the unit of extension is data, the schema for that data is the load-bearing decision, and it earns its own change with its own review before anything depends on it.

A detail from that schema is worth pulling out because it is the kind of thing that protects you later. The validator fails closed on unknown fields. An early critique pointed out that silently accepting a forward-looking field - an `extends:` key meant for a future inheritance feature, say - is a foot-gun: you ship configs that look valid and mean nothing. So the validator rejects the reserved field with an explicit error that points at the future amendment, rather than swallowing it. A manifest schema that is permissive about fields it does not understand is a schema that lets misconfiguration masquerade as configuration.

## Build the reference once, then skin it

A schema is a promise. The first vertical is where you find out whether the promise can be kept. We built law as the worked reference, end to end, and then extracted the reusable factory from the real build rather than designing the factory in the abstract.

That ordering matters. The factory - the manifest skeleton, the spec template, the operating model for what a pack contains, the hand-off prompt for the agent team that builds the next one - is the residue of having actually built one pack to completion. A pack, we settled, is five artifacts: a vertical spec, a manifest, a deliverability proof, a marketing surface, and a delivery SOP. We know it is five because building law surfaced all five. A factory designed before the reference would have been a guess about what a pack needs; a factory extracted from the reference is a description of what a pack needed.

The next two verticals - insurance and veterinary - were skinned from the law reference to the same depth, and they were built stacked on the law pilot precisely because they inherited its template and its factory. The fan-out from there to the rest of the dozen was nine more packs against the same registry. The marginal vertical had become a copy of a known shape, not a from-scratch build. That is the curve we were after: the cost of vertical N is the cost of filling in a template, not the cost of building a product.

## The differences are data, not code

The interesting test of a templating architecture is whether the real differences between industries fit inside the template or burst out of it. They are not small differences. Three examples from the packs we built:

Integration depth varies wildly. The law pack connects through an existing practice-management MCP server and needs no custom connector at all. The insurance pack has no such integration available - the agency management system exposes no MCP - so the pilot needs a built adapter, the largest hand-off in the line, and carrier data is read through the management system rather than via per-carrier connectors. Veterinary sits between the two: cloud practice-information systems expose modern open APIs, so the adapter is lighter than insurance's legacy integration and heavier than law's ready-made MCP. Three very different integration efforts, and all three map onto the same practice-management capability in the schema. None of them required a change to the capability enum. The variation lived in the manifest and the adapter directory, not in the core.

The compliance floor varies, and it is the part you cannot get wrong. Each vertical declares its own boundary as data. The professional-license verticals - law, insurance, accounting - draw the line at unauthorized practice and configurable authority: the license is the point, and the human sets how far the agent may go. The clinical verticals - veterinary, dental, med-spa - keep the medicine with the licensed clinician who examined the patient, and a possible emergency fails open to a human rather than being judged by the agent. The financial verticals never move money or touch wire instructions and fail closed. These are not code paths scattered through a fork. They are declared floors a pack carries, which means the boundary for a vertical is reviewable as a single artifact instead of being reconstructed from behavior.

Even the wedge - the specific connective job the pack actually sells against - is expressed at the pack level. The law wedge names the coordinator job and covers it end to end, inquiry through engagement through stalled-matter follow-up, with every outbound message held under reviewer-as-sender. It ships as a set of skills with fixtures and evaluations, graded by fresh-context executors against frozen expected outputs so the safety invariants are tested, not asserted. The full catalog grew to fourteen skills, with the pilot persona deliberately kept lean and the rest enabled per engagement. A skill is a unit inside a pack; turning one on for a client is a configuration change, not a deployment.

## The fixtures-and-evals discipline

One thing the manifest architecture does not give you for free is confidence that a vertical actually behaves. A declared compliance floor is a promise; the evals are how you check the promise holds. Each pack ships deliverability fixtures - substance-free connective artifacts a practitioner in that industry would recognize - and the skills are graded against frozen expected outputs by executors that see only the skill and the input, never the answer key.

That blind grading is what catches the dangerous cases. The law wedge holds the unauthorized-practice line under bait ("do I have a case?", "what are my chances?"). The trust-balance skill emits zero fund movement even when explicitly asked to move money, and the underlying adapter exposes no fund-movement tool at all, so the boundary is defended twice. The veterinary fixtures route a possible-emergency message to a human with zero medical advice. These are properties of the pack, verified per pack, and they ride the same per-vertical structure as everything else. The architecture that makes a vertical cheap to add is the same architecture that makes a vertical's safety floor a discrete, testable artifact.

## The transferable lesson

When one product has to serve many variants - many industries, many tenants, many configurations - the instinct to fork is the instinct to make every variant a maintenance liability. The discipline is to make the variant a piece of data the core product reads, and to make the core product carry no knowledge of any specific variant.

Concretely: define the manifest schema before you build a single variant, and make it fail closed on fields it does not understand. Build one variant end to end as the worked reference, then extract the template from it rather than designing the template up front. Push the real differences - integration depth, compliance floor, the specific job, the individual skills - into the manifest and its directory, and keep the capability surface in the core generic enough that a new variant maps onto it without a core change. Ship fixtures and evaluations per variant so each one's boundary is a tested artifact, not a hope.

Do that and the cost of the next industry is the cost of authoring a manifest and a directory, graded against its own fixtures. Fork instead, and the cost of the next industry is another copy of the whole product to keep alive. The architecture decision is which of those two curves you want to be standing on when the dozenth client signs.

---

_We build a productized AI employee across a dozen industries on a manifest-and-addon pack architecture, with per-vertical fixtures and evals. This article describes pack-architecture work landed across May and June 2026; the schema, the law reference and factory, the full vertical catalog, and the law wedge's fixture-graded skills are built and tested, with per-vertical infrastructure delivery staged per engagement._
