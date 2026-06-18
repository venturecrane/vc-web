---
title: 'Dead Code Removal Is a Security Audit, Not Just Cleanup'
date: 2026-06-12
description: 'Deleting old adapter code forces a semantic comparison you would not otherwise do - and that is where security gaps surface, not where they get introduced.'
author: 'Venture Crane'
tags: ['security', 'agent-operations', 'architecture', 'process']
draft: false
---

When you delete old code, you are not just reducing surface area. You are forcing a semantic comparison between what you are removing and what replaced it - and that comparison is where security gaps surface, not where they get introduced.

The migration away from an integration aggregator produced a security finding that illustrates why deletion deserves its own review step. The practical work looked like cleanup: retire in-tree adapter modules that no longer had live callers, update the connector table, remove a provisioning prompt that had become a dead step. The security finding came from the deletion itself, not from any of the new code.

## The Migration Shape

The aggregator had been our default path for connecting an internal product to external systems. As first-party MCP servers became generally available from a range of vendors, we reworked the connector table: vendor-direct first, then vetted community servers, then build it ourselves, with the aggregator as a long-tail fallback for vendors that never ship a first-party MCP server.

Eight connector rows moved to vendor-direct endpoints. One stayed as a build-it-ourselves connector because the vendor had not shipped yet. With no currently planned binding using the aggregator, we retired its default path and the provisioning ceremony that went with it - an API key prompt that had been firing on every new customer - a dead step surfaced during a standup audit.

We were deliberate about not removing the aggregator capability entirely. The schema validator and the runtime guard still accept its backend prefix. We retired the default, not the fallback.

## What the Deletion Revealed

When we went to remove the in-tree adapter modules, we did a semantic diff against the replacement: a runtime overlay guard that handles tool calls under the new vendor-direct doctrine. The new guard is architecturally stronger. It adds a post-call hook that inspects each tool result, which is the right shape for a system where different vendors expose different tool surfaces under different auth contexts.

But the diff showed the two were not equivalent.

The old in-tree code did one thing the new overlay guard does not: it emitted an audit event when it detected a cross-customer isolation breach. The new guard correctly refuses the breach - the enforcement is intact. But it refuses silently. A cross-customer leakage attempt is now blocked and unrecorded.

That is a specific failure mode worth naming: a security upgrade that loses a defensive-depth property.

## Why Deletion Triggers the Finding

The comparison only happened because we were about to delete. That is the structural reason deletion is a security audit trigger.

During normal development, the new code gets reviewed on its own terms. Does it enforce isolation? Yes. Does it have the right hook shape? Yes. Does it handle the vendor-direct protocol? Yes. The review passes because the questions it asks are about the new code's own correctness, not about what it replaced.

When you delete old code, the question changes. The question is no longer "does this new thing work?" It is "are these two things equivalent?" And equivalence checks surface omissions that correctness checks miss.

If we had retired the aggregator path without deleting the adapter modules - left them as unreachable dead code - we would have kept the audit emission behavior alive in code that never ran, which is worse than useless. The detection capability would have looked present on a feature list while being invisible at runtime.

Built-but-unwired is more dangerous than not-built, because it reads as done and is invisible until the day it was supposed to fire and did not.

## The Honest Fix

The tempting move when you find this kind of gap is to patch it quietly and move on. The migration is mostly done. The new architecture is stronger. The gap is narrow.

The right move is to name it explicitly.

We flagged the missing audit emission as a tracked item against the overlay guard - and closed it in the sprint that followed - rather than pretend the migration was clean. The reason is not process hygiene for its own sake. It is that "stronger enforcement, quieter violations" is a tradeoff that affects anyone operating the system. An operator whose audit log goes silent during an isolation breach cannot distinguish "no breach attempts" from "breach attempts that were refused but not recorded." Those are operationally different states.

A security team that does not know about the tradeoff cannot compensate for it. Naming the gap lets them compensate: tighter monitoring at the network layer, a periodic assertion that the audit log has expected density, a follow-up fix. Hiding it forecloses all of that.

## The Generalized Pattern

This is not specific to MCP connectors or aggregator migrations. Any time you retire code because a replacement was built, the deletion step should include a semantic comparison:

- What did the old code do, not just at the enforcement layer, but at every layer? Logging, telemetry, audit events, error surfaces, side effects.
- Does the replacement cover all of those behaviors, or does it cover the enforcement behaviors and assume the rest were implicit?

The implicit behaviors are where the gaps live. Enforcement is the thing that gets reviewed. Observability is the thing that gets assumed.

The pattern generalizes further: any security property that exists only at a single layer is a candidate for this failure mode. Enforcement that does not emit, rate limiting that does not alert, auth that does not log - these are gaps waiting to be exposed when the code that happened to cover them gets retired for unrelated reasons.

Delete the old code. Do the semantic diff. Name what did not transfer.
