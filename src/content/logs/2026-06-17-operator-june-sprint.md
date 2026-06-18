---
title: 'Conversational Channel, Model Tiering, and Security Hardening - June Sprint'
date: 2026-06-17
tags: ['ai-employee', 'agents', 'security', 'infrastructure', 'architecture']
draft: false
shipped: 'Conversational channel, model tiering, governance hardening, and fleet observability across the AI employee product'
---

_Retroactive log - reconstructed from commit history and session notes._

Email triage used to run on a cron. That's the wrong architecture for a product that's supposed to behave like an employee.

This sprint replaced the polling model with an event-driven push channel for the AI employee product we're building. We also closed a security finding that should have been obvious - but wasn't until a cold audit forced us to trace the process user ID against every file it touched.

## Conversational Channel

The old approach: a scheduled job would poll for inbound email on an interval, classify, and dispatch. Fine for a batch pipeline. Wrong for a product that's supposed to respond like a person.

The new approach: email arrives, a notification fires immediately, MCP tools execute in the context of the conversation interface, and production actions happen through that same channel. We used claude.ai with MCP wired to the product's tooling as the execution surface. Live-verified end-to-end - an inbound message triggering a real production action through the conversation, not through a separate scheduled process.

The architectural shift matters beyond this product. Polling creates an implicit latency floor that you cannot tune away. An event-driven push channel ties response time to infrastructure, not to schedule intervals. When the product is supposed to behave like a colleague, the difference between "responds within the next polling window" and "responds when the event fires" is the difference between a tool and a teammate.

## Two-Tier Model Selection

We added main model and escalation model fields to the per-customer configuration schema. Claude Sonnet handles the default reasoning path. Claude Opus handles escalation when the task complexity warrants it.

The seam is config-driven. No hardcoded model IDs in the application layer - the customer record determines which model each tier resolves to. Cost-tested live on the first deployment.

This matters for a multi-tenant AI employee product because the cost profile of an interaction varies by task type, and you cannot know that in advance. A config-driven escalation path means you can tune the threshold per customer without a code change. It also means you can add a third tier - or drop to a cheaper model for simple lookups - without touching the core reasoning loop.

## Governance Hardening

The per-customer configuration artifact and the governance directory are now root-owned: UID 0, GID 0, permissions 0600. The agent process runs as a non-root user and cannot write to either.

This closes the finding that the agent could theoretically modify its own authority configuration at runtime. We also closed multiple related findings from a comprehensive internal audit covering input validation, code-execution classification, taint-gate enforcement, and audit emission completeness.

Each of those findings had the same root cause: the initial implementation was built for correctness, not for adversarial conditions. The audit changed the frame from "does this work as designed" to "what can the agent do that its operators did not intend."

## Fleet Health Monitoring

We added a scheduled health-check that polls a fleet health endpoint every 30 minutes and surfaces degraded or failed instances. Alerts route to a real recipient - not a log file, not a dashboard that requires someone to remember to check it.

The constraint we designed around: an AI employee product in a pilot phase has a small enough fleet that you can poll every 30 minutes without load concerns, but a high enough stakes per-instance that a degraded state needs immediate human awareness. Passive logging does not satisfy that requirement.

## Overlay Drift Detection

Each running instance reports its current overlay ref. We built a drift check that compares that reported ref against the expected current ref and surfaces stale instances.

Stale overlay refs are a class of failure that is invisible to health checks. The instance is running, responding, and reporting healthy - but executing against an old configuration snapshot. Drift detection makes this visible without requiring a manual audit of each instance.

## Pilot Preparation

We completed the security questionnaire for a prospective enterprise pilot customer. The research and readiness pass confirmed the product can handle the vertical's compliance requirements. This was a real assessment against real requirements, not a template exercise.

## What surprised us:

The root-ownership finding. In retrospect it is obvious - if the agent process can write to the file that defines what the agent is authorized to do, you do not have governance, you have a suggestion. But "obvious in retrospect" describes exactly the class of finding that does not surface from reading the code. You have to trace the process user ID against the file ownership chain on the live system. The finding only appeared because the audit treated the running process as the subject, not the source files. That is the right frame for any system where the agent and its authority config share a filesystem.

## What's next:

Live first session with the pilot customer.
