---
title: 'We Accidentally Built a Shadow System of Record'
date: 2026-06-20
description: "A review caught our agent console rendering the customer's own data back to them. We had built a shadow system of record nobody designed."
author: 'Venture Crane'
tags: ['architecture', 'security', 'agent-operations', 'agents']
draft: false
---

A page-by-page review of our product caught something nobody designed on purpose. We had built a customer-facing console over an agent that works inside our customers' own systems, and one of its screens rendered the customer's own data back to them: their records, a document timeline, their pending work. Read that description back and the problem is obvious. We had quietly built a second copy of the customer's system of record, living inside our product, that we now had to secure, retain, and explain. Nobody decided to do that. It accreted.

This is the kind of mistake that does not announce itself, because every step toward it is reasonable. We are writing it up because the boundary we landed on is one we wish we had drawn at the start, and because the trap is structural - any team building a console over an agent that works inside someone else's systems is walking toward the same edge.

## How the data surface accretes

Nobody sets out to build a shadow database. Each screen answers a reasonable question. "What is the agent working on right now? Show me the context." And each answer pulls a little more of the customer's content into your product. A list becomes a detail view. A detail view needs the underlying record to be useful. The record needs its history to make sense. Three screens later you are rendering the customer's business data, and it feels like product completeness, not a liability.

The same drift showed up below the surface. The review found a typed, vertical-shaped reference field baked into the data model, a hardcoded lifecycle enum that encoded a specific vertical's workflow into product structure, and a console button that held a draft and transmitted it - the product reaching in and acting on the work itself. Every one of those was a symptom of the same missing boundary. The detail view was just the most visible.

The reason this matters is not aesthetic. The moment your console displays the customer's business data, you are a system of record you never intended to be. You inherit its sensitivity, its retention obligations, and its breach surface, and you take all of that on in exchange for a screen the customer could already open in the source system. It is pure downside, paid for in the currency that hurts most: data you are now responsible for and did not need to hold.

## The model that draws the line once

The fix was not a list of screens to delete. Delete them by hand and they grow back, because the question gets re-litigated on every new feature. The fix was a model that decides the question once: the console is the management layer for the agent, the same way a manager relates to an employee.

When you hire a person, you do not get a screen that re-displays your own files. You get the means to direct them, to account for what they did, and to administer the relationship. That maps onto exactly three jobs, and a console built over a customer-installed agent should do these three and nothing else:

- **Direct** - the terms of employment. Who the agent is and what it may do: scope, entitlements, the human-approval posture, which systems it connects to, which skills are live. Backed by per-customer config.
- **Account** - the record of what the agent did and the authority it acted under, available as compliance evidence on request. Backed by an audit log of the agent's own actions.
- **Administer** - the relationship: team and roles, coverage, escalation contacts, subscription, notifications. Backed by config plus access management.

Those three jobs line up one-to-one with the only three things the platform should store: per-customer configuration, encrypted credentials, and an audit log of the agent's actions. The customer's business data is not on that list, so it is not on a screen.

## The test that decides every surface

Doctrine is only useful if it settles cases mechanically. Every surface, field, and feature gets one question:

> Does it show the agent's configuration, the agent's own actions and output, or account and relationship admin? **In.**
> Does it show, store, or mirror the customer's business data? **Out, full stop.**

To see your records, you open your record system. The console manages the actor; it is never where the acting happens, and it is never a second place to look at the work.

Two corollaries fall out of the test, and both are where the discipline earns its keep.

**The audit log records how the agent acted, not what it touched.** It stores metadata: timestamp, which agent acted, the action class from a finite authored vocabulary, the connector the action went through, the entitlement that permitted it, and the outcome. It does not store bodies, documents, readable personal data, or any natural-language description of the work. The log answers "did my agent act within its bounds?" It does not narrate the work. If you want the story, it is in your own tools.

**References to the customer's objects are opaque handles.** There is no typed, per-vertical reference field. There is one shape: a connector identifier we authored, plus the source system's own handle stored as an opaque string we never parse, validate, or branch product logic on. We hand it back to the connector if a label is wanted, resolved transiently with the viewer's own credentials, persisting nothing. This is the part that pays off in engineering cost, not just risk. Per connector, you verify one thing: that you can record an opaque handle, hand it back, and connect with a scoped token. You never test that you understand any system's objects. The "every vertical times every system" matrix never enters your correctness path, which is what lets one product stay genuinely vertical-agnostic instead of carrying a sector-shaped assumption in its schema.

## No button that touches the work

The same boundary rules out the "approve and send" button the review flagged - and removing it is still on our list, which is the honest state of this. If external sends require a human, that is an entitlement configured under Direct: the agent simply does not hold send authority. The approval then happens where the work lives. The agent leaves a draft in the native tool and a person reviews and sends it there, or, for a channel with no draft state, the agent asks over the same conversational pipe it talks on and the human answers there. The only buttons in the console change the employment - grant a role, flip an entitlement, connect a system. Everything about the actual work is read-only, a lens on the audit record, never a control.

## When this applies, and when it does not

This boundary is for agents that act inside systems someone else owns: a customer-installed agent, a multi-tenant platform, anything where the data the agent touches is not yours. There, re-hosting that data is pure downside. It does not apply when the data genuinely is yours - a product whose own database is the system of record should obviously render it. The trap is the in-between case, the agent that works _over_ a customer's systems while you quietly accumulate a mirror of them on the side. That is the case that accretes, and it is the one worth a hard rule.

## The durable takeaway

An operator console is a management console. It manages and observes the agent - config, authority, actions, health - and it is not a system of record. The test is one question asked of every surface: is this the agent, or is this the customer's data? Build the screens that answer the first and refuse the ones that answer the second, and the console stays a thin, vertical-agnostic management layer instead of the shadow database we caught ourselves building. The agent works in the customer's house. Your console runs the agent. It does not move into the house.
