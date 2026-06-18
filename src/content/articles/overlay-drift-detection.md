---
title: 'Overlay Drift: The Fleet Observability Gap That Looks Like a Deployment'
date: 2026-06-20
description: 'Deploying a new agent overlay version does not mean all running instances have it - persistent fleet processes require active drift detection, not deployment confirmation.'
author: 'Venture Crane'
tags: ['infrastructure', 'agent-operations', 'observability', 'fleet-management']
draft: false
---

Deploying a new version is not the same thing as having a new version. For web services this is mostly a non-issue - a load balancer routes to the new container, the old one drains and exits, and within minutes the fleet is coherent. For a fleet of persistent AI agent processes, the story is different. Processes stay up. They do not naturally shed their in-memory state or reload their configuration layer. You can push a new overlay version and have half your fleet running it, the other half running something from last week, and no automatic signal telling you which is which.

This gap surfaces in persistent-process architectures deployed on Fly.io Machines. The architecture separates a base agent layer - which handles model inference and base tooling - from a runtime overlay that carries product-specific capabilities, connector configurations, and security policies. The overlay is a versioned git ref, and instances are supposed to pick up the current ref on their next reload cycle. "Supposed to" is the problem.

## Why Persistent Agents Break the Deployment Mental Model

A containerized web service is stateless by design. Kill it, start a new one, traffic moves. A persistent agent process is not stateless. It holds active session context, in-flight task queues, and possibly long-running model calls. You cannot casually restart it the way you restart an nginx worker. So instances accumulate uptime - and with uptime comes version drift.

The overlay ref is a git commit hash. When an instance starts, it fetches the overlay at that ref and loads it. If the instance never restarts, it never re-fetches. A new overlay can ship with a critical security policy change - a connector scope restriction, a tool allowlist update, a prompt guard revision - and an instance that was already running when the push happened will never apply it. It will run indefinitely on the stale policy.

This is behaviorally different from a version mismatch in a web tier. A stale web tier instance might serve a deprecated API response. A stale agent instance might authorize a tool call that the new overlay was specifically shipped to block.

## What Drift Detection Looks Like

The fix is straightforward: expose the current overlay ref from every instance, then poll and compare.

Each Fly.io Machine exposes a health endpoint extended to include the loaded overlay ref alongside the standard liveness indicators. The ref is a short git hash recorded at instance startup - whatever was pinned when the overlay loader ran. This is the actual-state value.

A management process running on a separate Machine polls all registered instances on a fixed interval. It has access to the expected ref - the current tip of the overlay release branch - and compares it against every reported ref. Any instance reporting a hash that does not match the expected ref is flagged as drifted.

The comparison output is simple: a list of instance IDs, their reported refs, the expected ref, and how many commits behind each drifted instance is. That last number matters because a one-commit drift on a routine update is a different severity than a twenty-commit drift that spans several security patch releases.

## Desired State vs. Actual State for Behavioral Configuration

Container orchestration tools talk about desired state constantly - you declare what you want, the system converges. The version of convergence that most tools implement is at the container image level. A new image gets scheduled, old pods terminate, new pods come up.

Overlay refs are inside the container. They are behavioral configuration, not image configuration. A container running image v3.1 might be executing overlay ref `a4f9d2b` or `8cc31e0` - the image tag tells you nothing about which. Fly.io Machines does not know that the overlay exists, let alone what ref each instance is pinned to. This is a layer of state that standard orchestration observability cannot surface.

This class of problem will become more common as agent deployments mature. The base runtime stabilizes - inference behavior, session management, core tooling - and the high-velocity layer becomes the overlay: skills, connectors, access policies. The base image changes monthly. The overlay changes weekly or faster. Relying on image-level observability to reason about overlay-level state is a category error.

## Remediation Tradeoffs

When drift detection surfaces a mismatch, three options exist and each has a real cost.

Auto-restart is the fastest path to coherence. The management process calls the Fly.io Machines API to stop and restart drifted instances, which forces an overlay re-fetch on startup. The cost is session disruption. Any in-flight work on that instance is interrupted. For agents handling idempotent or short-horizon tasks, this is acceptable. For agents mid-way through a multi-step task with external side effects, it is not.

Alert-and-wait preserves session integrity. The management process emits an alert, marks the instance as drifted in its registry, and waits for the instance to reach a natural stop point. This is appropriate when the drift is low-severity - a documentation update, a non-security connector change - and the disruption cost of forced restart outweighs the risk of running on the stale overlay for a few more hours.

Manual intervention is the right path when the drift is high-severity and the session cannot be safely interrupted. An operator reviews the in-flight task state, decides whether to checkpoint and restart or let the task complete, and then forces the reload. This path requires that instance state be inspectable, which is a prerequisite worth building before you need it in an incident.

## What the Monitoring Surface Needs to Show

Drift detection is only useful if the result routes to a real recipient and surfaces immediately. Treating it as a log entry that requires a separate manual query - or a dashboard tab that requires someone to remember to check it - defeats the point. The coherence signal, instances on the expected ref divided by total instances, should route to the same alerting path as other fleet health signals, so a drop below 100% is visible without hunting for it.

The underlying principle is that behavioral configuration is infrastructure. It deserves the same first-class observability treatment as CPU utilization or request latency. A fleet where every instance is healthy by uptime metrics but a significant fraction are running a stale security policy is not a healthy fleet. The monitoring surface should make that visible without hunting for it.
