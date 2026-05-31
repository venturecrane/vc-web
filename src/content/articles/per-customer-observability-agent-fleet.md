---
title: 'Observability That Is Born and Dies With the Tenant'
date: 2026-05-30
description: 'When every customer runs an isolated agent deployment, monitoring becomes per-tenant and lifecycle-aware. The heartbeat, webhook, and fleet stack we wired.'
author: 'Venture Crane'
tags: ['observability', 'infrastructure', 'monitoring', 'cloudflare-workers']
draft: false
---

We are building an AI employee product. Each customer gets their own isolated deployment: a dedicated agent instance running on its own machine, with its own secrets, its own audit log, its own error stream. No shared runtime, no multi-tenant request path. One customer, one isolated agent.

That isolation is good for security and blast radius. It is inconvenient for observability. You cannot watch a fleet of isolated instances with a single global error dashboard, because there is no single global anything. Each instance fails on its own, in its own process, and the only way to know is to ask each one. So the question we had to answer was not "how do we build a dashboard" but "how does monitoring get created and destroyed in lockstep with the thing it monitors."

This is a build-log honest account. Some of what follows is wired and tested; some is designed and staged behind missing credentials. We will be clear about which is which.

---

## The Shape of the Problem

A single multi-tenant application has one error stream. You point Sentry at it, you watch the graph, you are mostly done. When a tenant has a problem, it shows up as a spike in the one place you are already looking.

Isolated per-customer deployments invert that. There is no shared process to instrument once. There is a population of processes, each of which can be healthy, degraded, or silently dead, and the failure mode we cared about most is the silent one: an instance that stops doing anything and emits no error because it is no longer running to emit anything. A global error dashboard is blind to that by construction. Absence of errors from a dead instance looks identical to absence of errors from a healthy one.

So we needed two things at once. Per-customer signal, so we can tell which specific instance is in trouble. And a fleet-wide rollup, so an operator has one screen that answers "is everyone okay" without opening one dashboard per customer.

---

## What Shipped

The decision document is an architecture record that sits on top of our existing per-customer machine isolation. It introduces four concrete pieces, plus the connective tissue to make them legible as a fleet.

**A heartbeat endpoint.** Each instance runs a ticker that POSTs to an internal endpoint roughly every minute. The payload is small: a heartbeat timestamp, optional last-audit and last-skill timestamps, process uptime, and a version string. The receiver derives a heartbeat status from freshness and writes it to a control-plane table. The instance also pushes to healthchecks.io on a separate cadence. We chose push over pull deliberately. A pull-based health check has to know every instance's address and reach it; a push model means a dead instance simply stops pushing, and the absence is the signal. healthchecks.io flips a check to "down" when a ping does not arrive in time, which is exactly the silent-death case a global error stream misses.

**Webhook receivers for the external signal pipes.** Two HTTP receivers ingest events rather than us polling for them. One accepts Sentry webhooks, verifies an HMAC-SHA256 signature over the raw body, enforces a replay window on the timestamp, and pulls the tenant out of the event's tags. The other accepts healthchecks.io notifications. Worth noting: healthchecks.io does not sign its webhooks, so that receiver authenticates with a shared bearer token and a user-defined JSON body instead of a signature. When a healthchecks event reports a check as down, the receiver also writes the affected instance's heartbeat status to red directly, so the alert path and the dashboard column cannot contradict each other during an outage. Both receivers compose with the webhook surface we already had rather than standing up a new worker.

**A cost-anomaly worker that doubles as a fleet-status writer.** A scheduled worker already existed to watch spend. We extended it to sync the last 24 hours of error counts per tenant from Sentry's events API and write them into the same control-plane table the heartbeat feeds. The sync function never throws. It returns a tagged result, one of ok, unavailable, http-error, or parse-error, and on anything other than ok it writes a null count. The dashboard renders null as a dash, never as zero, because "we could not measure" and "we measured zero errors" are very different facts and conflating them is how you build a monitor that lies. The worker bootstraps a fleet-status row if one does not exist yet, since a sync can run before a freshly provisioned customer has sent its first heartbeat.

**A source tag on every alert.** Alerts now carry a source column, constrained to a small set: cost, sentry, healthchecks, audit-integrity. The default is cost, which preserves the existing writer's behavior without touching it. The tag means that when an operator sees an alert, they know which signal pipe raised it. A spend anomaly and a crashing process are different problems with different responses, and an undifferentiated alert stream forces a human to reverse-engineer which is which.

The rollup itself is not a polished standalone dashboard. It is three new columns on the cost admin page we already had: heartbeat status with a staleness color and a relative-time label, Sentry errors in the last 24 hours, and uptime. The heartbeat display has one rule we enforced in tests: it never lies in the reassuring direction. A stale heartbeat renders red with its actual age, regardless of how recently the row was last written. The alerts banner switches to source-tagged rendering so cost rows keep their detailed display and non-cost rows show a source-specific summary.

That is the fleet view. Tables and receivers feeding a few columns, not a bespoke control center. For one customer, that is the right amount.

---

## The Part That Is Actually Hard

The pieces above are conventional enough. The subtle part, the reason this is a lesson and not a changelog, is lifecycle.

When monitoring is global, it has no lifecycle of its own. It exists, it watches whatever is there, and you never think about its birth or death. When every tenant is an isolated deployment, that assumption breaks. Each instance's observability has to be provisioned when the customer is onboarded and decommissioned when they leave, in the same lifecycle as the agent itself. Get this wrong in one direction and you have orphaned alerts firing for instances that no longer exist. Get it wrong in the other and you have a new customer running blind because nobody created their monitoring.

So provisioning a customer now stages the monitoring as part of standing up the instance. The provision script pushes the Sentry DSN and the shared heartbeat key as machine secrets, creates a healthchecks.io check whose name and tags make re-runs idempotent and captures its ping URL back as a secret the ticker uses, and seeds a fleet-status row so the dashboard renders "no signal yet" before the first heartbeat instead of showing nothing. Each step degrades gracefully: if a credential is missing in a development run, it warns and skips rather than failing the provision.

Decommissioning is the mirror image, and it is the half people forget. When a customer leaves, their monitoring has to leave too. We added an observability-cleanup step to the decommission pipeline that cancels the healthchecks.io check and deletes the fleet-status row. It runs after the machine teardown, as control-plane housekeeping rather than part of destroying the machine. There is a small honest gap: between destroying the instance and cancelling its check, healthchecks could fire one post-decommission alert. We documented that inline as acceptable noise rather than weaving observability into the core teardown sequence and making that sequence more fragile to save one stray ping.

The cleanup is built behind a stub for now. The protocol and the pipeline step are in place and tested; the live client that actually calls the healthchecks delete and the control-plane delete is deferred until the second customer onboards, when we wire it with real credentials. That is the candid status: the lifecycle symmetry is structurally present and exercised by tests, and one end of it is still a no-op stub waiting for a real implementation.

---

## The Transferable Lesson

The reason to write this down is not the heartbeat endpoint or the webhook signature scheme. Those are ordinary. The reason is the shift in where monitoring lives in your mental model.

In a multi-tenant system, observability is a thing you build once and point at the runtime. In a per-tenant isolated-deployment system, observability is a property of each tenant that must be born and must die with that tenant. If provisioning a customer does not create their monitoring, you have blind spots. If decommissioning a customer does not destroy their monitoring, you have alerts that lie about instances that are gone. The monitoring has to ride the same lifecycle as the workload, with the same symmetry, or your dashboard is describing a fleet that no longer matches reality.

Practically, that means a few habits. Treat "create monitoring" as a provisioning step, not a separate manual chore someone remembers to do. Treat "destroy monitoring" as a decommissioning step in the same pipeline, even when it is just control-plane housekeeping. Make absence a first-class signal, because in an isolated fleet a dead instance produces silence, not errors, and silence has to be loud. And tag every alert with where it came from, because once you have several signal pipes feeding one rollup, an undifferentiated alert is a puzzle instead of an answer.

Per-tenant isolation buys you a clean blast radius. The bill it hands you is that monitoring stops being infrastructure you set up once and becomes a lifecycle concern you provision and tear down per customer. Pay that bill at onboarding and offboarding, symmetrically, or your alerts will eventually describe a fleet that does not exist.

---

_We build and run isolated per-customer agent deployments on Cloudflare Workers, D1, cron, Sentry, and healthchecks.io. This article describes work landed in May 2026; some pieces are wired and tested, and the live decommission client is staged behind a stub until our second customer onboards._
