---
title: 'One Machine per Customer: Two Planes, Two Writers'
date: 2026-10-08
description: 'Isolation lives in the deployment topology, and config authority is a separate question: two writers reach the same bucket and neither holds the other key.'
author: 'Venture Crane'
tags: ['architecture', 'infrastructure', 'security', 'agents']
draft: false
---

Multi-tenancy for an autonomous agent is a topology decision, not a code decision. Where the configuration that governs that agent is authored, and who is allowed to write it, is a second decision, and it is the one more likely to be gotten wrong, because it looks like plumbing rather than like a boundary.

The system has two planes that share a vocabulary and not a runtime. The console plane is a single server-rendered application running as one edge Worker, serving the marketing site, the internal admin console, and the customer portal, and owning all structured business data. The agent plane is one isolated virtual machine per customer, each running the open agent runtime we build on plus our own plugin overlay. The console plane never reaches into a machine's database. Keep those two apart and the rest of the architecture follows.

## Isolation in the topology, not in the scoping layer

Three patterns were available for separating one customer's agent from another's.

The standard one is a shared runtime with tenant scoping: one process serves everyone, a tenant identifier rides every call, storage queries are scoped, and the guarantee lives in the scoping layer. That is the right pattern when the cost of cross-tenant leakage is bounded and recoverable. It is not the right pattern here, where an agent holds a customer's confidential records under an obligation that makes a leak existential for the customer rather than embarrassing for us.

The second is a shared runtime with per-customer namespaces. The guarantee lives in application code. It is auditable, but only as good as the code review, and a bug in the scoping layer is a cross-customer leak.

The third is what shipped. Each customer gets a dedicated machine, its own storage volume, its own connector credentials, its own pinned skill catalog. There is no network or storage path from one customer's agent to another's data. Cross-customer access is not denied by code. It is architecturally impossible.

The honest cost is that this is the expensive option, and the expense is recurring and per customer. It also makes some engineering fixes into commercial decisions. When one class of deployment turned out to need double the memory to avoid a startup failure, raising the floor across the fleet was a cost question for the person paying the bill, not a call an agent or an engineer gets to make on their own.

## The seam between the planes

The admin console needs to show an agent's live runtime state, and that state lives on the customer's isolated machine, which the console cannot query across the boundary. The bridge is one narrow read path, and it encodes four invariants that do not bend.

It takes exactly one customer per call. There is no list form and no surface that joins across customers, which means the isolation property cannot be eroded by a convenience endpoint someone adds later.

It is read-only. The transport exposes a read verb and nothing else, and no mutation path exists on it.

It is audited at the console, separately from the agent's own runtime audit record, so there is a record of who looked at what that is not written by the thing being looked at.

It fails closed. A transport error resolves to an empty result carrying a reason, never a thrown exception that breaks a portal render.

The per-customer read key is derived by keyed hash from a master secret that lives only on the console Worker and is never present on any machine. A machine cannot mint a key for another machine because it does not hold the input.

## Two writers, two directions, two keys

Configuration reaches a machine through object storage, and two different writers put things there. They never share a key, and the reason they do not is worth spelling out, because the tempting design is one write path with permissions on top.

The governing configuration file is authoritative in git and published to the customer's prefix by continuous integration on merge. The console deliberately does not write it. A portal write would be silently clobbered by the next unrelated merge touching that customer, which is the worst failure available: a setting a person changed and watched take effect, reverted later by a process neither of them was thinking about.

The customer's own authored voice and format specifications go the other way, from the portal into a separate object under the same prefix. That is prose a customer edits in the product, and no portal actor could reasonably be asked to put it in git. Two objects, two writers, two credentials, and the on-machine appliers pull both.

The separation is structural rather than procedural. Each writer is barred from the other's key, so the rule survives whoever forgets it.

## The decision that was reverted

There was an accepted decision, described in an earlier piece on live reconfiguration, to go further and make object storage the operational source of truth, with a live apply path so a configuration change could reach a running agent without a reboot. It was reverted, and the reversal is the more useful half of the story.

The apply path was never built. What did get built was the scaffolding around it: a divergence guard, two provisioning modes, a reconciler, and a daily workflow to keep git honest against a source of truth that had not moved. Since nothing ever wrote to storage outside of continuous integration, storage never diverged from git, and the reconciler guarded a window that could not open. The daily workflow failed loudly every morning on a scoped credential nobody had minted.

It was removed root and branch. Git is the single source of truth for the governing file, which is what the earlier decision had said before this one amended it. The design stands as the plan for the day live reconfiguration is actually needed, and nothing in it is running.

The reason to keep the design on file rather than delete it is that it named a hazard that applies to any agent whose authority is described in a file the agent can reach. A push endpoint on the machine, authenticated by a key already present in the agent's process environment, lets a prompt-injected agent rewrite its own ceiling file through a local call to itself. That is a ceiling raise authored by the thing the ceiling constrains. The countermeasure is not a better check inside the endpoint. It is that the agent holds no inbound verb that can trigger a configuration change, and no credential that can write the configuration object.

That second half turned out to be harder than it reads. The account-wide storage credential is stripped from the environment before the agent process starts. It survives in a sibling process forked before the strip, and the agent's own user can read that sibling's environment through the process filesystem. So an agent with code execution could recover a credential that was supposedly removed. Code execution is unauthored and fail-closed on the customer deployments, which makes this a gated hazard rather than an open one, and it stays on the list of things that must close before any live-apply design ships.

The privilege facts on the machine also decided who the applier would be. The configuration file is owned by the agent's own user. The broker that owns the audit ledger cannot write it, and cannot signal the agent across user identities. Root can do both. So the applier is root-owned and pull-based, which is a different answer from the one the design originally gave, and it changed because someone checked the ownership on a live machine rather than reasoning about it.

## One-way flows drift

A one-way flow is not self-enforcing, and this is the part that generalizes past our stack.

The publish step was triggered on merge and diffed one push range. A range that is never processed, because a deploy failed, a job was skipped, history was rewritten, or a branch was force-pushed, is never revisited, because no later push's range contains it. That is not a rare event and it produces no error. One customer's stored configuration row said one thing for eleven days while both git and the live machine said another, and nothing was watching, because nothing compared every row to git.

So there is a reconciler, and it runs on a schedule and again at the tail of every deploy. The schedule is what catches a range dropped weeks ago; the deploy-tail run is what stops a freshly failed publish from waiting a day to be noticed.

It covers two projections in two jobs under one workflow. One compares the database rows the portal reads against the commit they claim; the other compares the stored object the machine boots from, byte for byte. They are separate jobs because they share no code and because an outage in one storage system must not stop the other check from running. They are one workflow because a person asking "is what git authored what is actually live?" should find one answer in one place rather than needing to know there are two.

Both follow the same discipline as the other controls here. An exit that means the control could not evaluate fails the run on its own, and only an exit that means it evaluated and found something opens an issue. A control that pages on its own blips gets muted within a week.

## The rule

Put isolation in the topology when a leak is unrecoverable, and accept that you are buying it with recurring cost rather than with cleverness. Then treat configuration authority as its own boundary: if two writers reach the same destination, give them separate keys and separate objects rather than one path with permissions layered on, and make sure the agent holds neither key.

And whatever direction you declare your configuration flows, put a reconciler across it. A one-way flow triggered by a diff of a range is a flow that will silently skip a range, and the gap it leaves looks exactly like agreement.
