---
title: 'Live Reconfiguration for Persistent AI Agent Processes'
date: 2026-06-16
description: 'How to apply configuration changes to a running AI agent without downtime, and why "durable" apply semantics matter more than the detection mechanism.'
author: 'Venture Crane'
tags: ['architecture', 'agent-operations', 'infrastructure', 'configuration']
draft: false
---

A restart is not a neutral operation for a persistent AI agent. It interrupts in-flight work, discards accumulated conversational state, and in a per-customer deployment model, it signals downtime to the customer whose session just went cold. If your configuration lifecycle requires a restart to take effect, you have a deployment model, not a product.

Here is the design.

## Why Config Is the Product

A general-purpose AI agent running for a single customer is configured by that customer's requirements: which model tier to use, which external connectors are enabled, what trust ceilings cap autonomous action, what data sources are in scope. That configuration is not infrastructure setup that happens once at deploy time. It is continuous tuning.

During a live pilot, a customer notices the agent is making calls it should not be making and asks to tighten a trust ceiling. That change needs to apply in seconds, not in the next deployment window. During rollout, you discover two customers need a different connector enabled while a third needs one removed. These are not deploy events. They are product events.

The canonical software pattern - deploy new config, restart process, new config takes effect - breaks here because the restart cost is not measured in milliseconds of unavailability. It is measured in the work the agent was in the middle of. Restarting a mid-session agent that was processing a multi-step task requires re-establishing context, potentially re-executing work, and explaining the interruption to the customer. The restart is not free.

## What the Apply System Does

Live reconfiguration has three phases: detect, validate, apply.

**Detect.** The process needs to know a config change occurred. The three common mechanisms are file watching (inotify/kqueue), polling on an interval, or an admin endpoint that receives a signal when the config store updates. A common approach uses a combination - the process watches for an admin-triggered reload signal, which is pushed when a config write completes. Pure polling works but introduces latency proportional to the polling interval. File watching is fast but platform-specific and has edge cases around atomic writes.

**Validate.** Before applying anything, validate the incoming config against the full schema. This is not optional. An agent that partially applies a config and then fails validation is in an undefined state. The rule is: if the new config cannot be fully validated, the process keeps the last known-good state and surfaces a clear error. Fail closed. The agent continues running on the previous config. The customer sees an error on their config change, not a service interruption.

**Apply.** Once validation passes, apply the delta to the running runtime state. This means the apply logic has to distinguish between what changed and what did not. Replacing the entire runtime object on every config change is simpler to implement but forces unnecessary disruption - an active connector gets torn down and rebuilt even if its config did not change. Delta application is more complex but preserves continuity for unchanged components.

## What "Durable" Means

Naive live reconfiguration handles exactly one sequential config change: the process is idle, a change arrives, it applies. This works in development. It breaks in production.

The failure mode is overlapping changes. A customer submits a config change. Before the apply completes, a second change arrives - either because the customer made a correction, or because an automated system wrote a new value. A non-durable apply system handles this with one of three wrong answers: it drops the second change, it races the two applies and corrupts state, or it applies the changes in the wrong order.

Durable apply means: changes are serialized, not concurrent. While an apply is in progress, incoming changes queue. When the in-progress apply completes - successfully or not - the queue drains in order. The state after N sequential changes is deterministic and matches what would have happened if you applied them one at a time with no overlap.

This requires an explicit apply lock, a change queue, and a completion signal that advances the queue. The implementation is not complicated, but it has to be deliberate. The default behavior for most event-driven systems is concurrent handler dispatch, which is exactly wrong here.

## The Verification Requirement

Applying a config is not the same as confirming the config took effect.

After the apply completes, the system reads back the live runtime state and compares it against what the new config specified. If they diverge, the apply is considered failed and the fail-closed policy applies - fall back to the last known-good state. This closes a class of bugs where the apply logic runs without error but produces the wrong runtime state.

This verification step also matters for observability. Logging "applied config version X" without reading back the live state gives you a record of intent, not outcome. The verification log entry records confirmed state, not just the write operation.

## What This Enables

Once live reconfiguration is durable and fail-closed, several operational patterns become available that are otherwise impossible:

- Model tier switching mid-operation, without restarting or re-establishing session context.
- Adding a connector to a running agent when the customer enables a new integration.
- Removing a connector immediately when access is revoked, without waiting for the next deploy.
- Correcting a misconfiguration during a live pilot session, where a restart would end the session.

Each of these looks like a product capability to the customer. Underneath, it is the apply system doing what a restart used to do - but without the restart.

## The Generalizable Pattern

Persistent AI agents in production operate differently from stateless request handlers. The state they carry - session context, in-flight task progress, accumulated tool results - has a cost when destroyed. Config management has to account for that cost.

The pattern that follows from this: treat config as a live runtime concern, not a startup concern. Detection, validation, delta application, and verified confirmation are the four steps. Durability - serialized, queued, ordered application - is not a performance concern. It is a correctness concern. Fail-closed on validation failure protects the running process from invalid state. Verification confirms outcome, not intent.

Any persistent process that holds meaningful runtime state needs this pattern. For AI agents where that state includes customer context, the cost of getting it wrong is not just downtime. It is work that has to be repeated.
