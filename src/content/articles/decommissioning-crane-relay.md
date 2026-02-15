---
title: 'From Monolith to Microworker - Decommissioning the Relay'
date: 2026-02-15
description: 'We deleted a 3,234-line Cloudflare Worker, its database, and its storage bucket. Here is what we learned about scope creep in serverless architectures.'
author: 'Venture Crane'
tags: ['infrastructure', 'cloudflare', 'architecture']
draft: true
---

We deleted a Cloudflare Worker last week. Along with it went a D1 database and an R2 storage bucket. Nineteen files, 6,231 lines of code, removed from the monorepo in a single session. The system had been the backbone of our GitHub integration for months, and nothing noticed it was gone.

That last part is the interesting bit.

---

## What the Relay Worker Did

The relay worker started life as a simple HTTP bridge. Early in our setup, AI coding agents couldn't call the GitHub API directly - Claude Desktop, the tool at the time, had no shell access. So we built a Cloudflare Worker that sat between the agent and GitHub, proxying API calls over HTTP.

The initial scope was tight: receive a request from the agent, forward it to the GitHub API, return the response. Label an issue. Post a comment. Close a PR. Maybe five endpoints, a few hundred lines of TypeScript.

Then it grew.

First came webhook processing. GitHub could POST events to the worker, and the worker could react - new issue opened, label changed, PR merged. Useful, straightforward, still within reason.

Then came AI classification. When a new issue arrived, the worker would call Gemini Flash to analyze the issue body, extract acceptance criteria, assign a QA grade, and apply labels automatically. This required prompt engineering, structured output parsing, confidence scoring, and a schema for the grading rubric.

Then came evidence storage. Classification results needed an audit trail, so we added an R2 bucket to store raw model outputs and classification evidence.

Then came retry logic, idempotency keys, error handling for each of the upstream APIs, and a V2 event system that was designed but never fully adopted.

By February 2026, the relay worker was 3,234 lines of TypeScript doing at least four distinct jobs: HTTP proxy for GitHub API calls, webhook receiver, AI-powered issue classifier, and evidence archive. Each feature had been a reasonable addition in isolation. The aggregate was not.

---

## The Kill Signal

The decision to decommission wasn't driven by a refactoring sprint or an architecture review. It was driven by an accident.

While auditing Cloudflare secrets, we discovered that the relay worker's production deployment was missing its authentication secrets. The two keys it needed to accept incoming requests - both absent. Its API endpoints were non-functional in production.

Nobody had noticed.

No monitoring alert, no user complaint, no broken workflow. The worker had been silently failing (or more accurately, silently unreachable) for an unknown period. We searched the codebase: no MCP tools referenced its URL. No scripts. No slash commands. No CI jobs. Nothing in the entire monorepo was calling it.

We had migrated away from the relay worker without realizing we had migrated away. Two separate changes, made for their own reasons, had made it obsolete:

1. **Direct CLI access.** Once we moved from Claude Desktop to Claude Code, agents could shell out to `gh` CLI directly. The HTTP proxy pattern - agent calls worker, worker calls GitHub - became unnecessary overhead. Why proxy through a Cloudflare Worker when you can run `gh issue list` in a subprocess?

2. **A purpose-built classifier.** Webhook processing and issue classification had been extracted into a dedicated worker months earlier. That worker did one thing: receive a GitHub webhook, classify the issue with Gemini, apply labels. No proxy endpoints, no evidence storage, no V2 event system.

The relay worker was already dead. We just hadn't cleaned up the body.

---

## The Replacement Architecture

The focused classifier worker that replaced the relay's webhook processing is roughly 400 lines of TypeScript (compared to 3,234). It has three HTTP routes:

- `GET /health` - health check
- `POST /webhooks/github` - receive and classify issues
- `POST /regrade` - reclassify existing issues on demand

That is the entire API surface. One purpose: when a GitHub issue is opened, classify it.

The classification pipeline is straightforward. Validate the webhook signature. Parse the issue payload. Extract acceptance criteria from the issue body. Call Gemini 2.0 Flash with a structured prompt and response schema. Apply the resulting QA grade label (`qa:0` through `qa:3`) and optionally a `test:required` label. Log the result to D1 for auditability.

It has idempotency (both delivery-based and semantic, so re-delivered webhooks and unchanged issues do not get reclassified). It has skip logic (bots, already-graded issues). It does not have an HTTP proxy, an evidence bucket, a V2 event system, or any endpoint that says "do this arbitrary thing to a GitHub issue on my behalf."

The `wrangler.toml` tells the story of scope:

```toml
name = "crane-classifier"
main = "src/index.ts"
compatibility_date = "2025-12-15"

[[d1_databases]]
binding = "DB"
database_name = "crane-classifier-db"
```

One worker. One database. One binding. Compare that to the relay worker's configuration, which had a D1 binding, an R2 binding, multiple secret bindings for different auth mechanisms, and environment-specific overrides for staging versus production.

Everything the relay worker did beyond classification is now handled by `gh` CLI, run directly from agent sessions. Label management, issue queries, PR operations, comment posting - all of these are `gh` subcommands that agents call directly. No intermediary worker needed.

---

## The Cleanup Process

Decommissioning a worker is straightforward when you can prove nothing depends on it. Our verification process:

1. **Search the codebase.** Grep for the worker's URL, its name, any reference to its API endpoints. We found references in documentation and old configuration files, but zero live call sites.

2. **Check the secrets.** The missing production secrets were themselves evidence - if the worker had been needed, someone would have noticed the auth failures.

3. **Delete the Cloudflare resources.** The worker (both production and staging deployments), the D1 database (`dfg-relay`), and the R2 bucket (`dfg-relay-evidence`).

4. **Clean the monorepo.** Remove the worker directory, update `package.json`, remove references from CI workflows, security configurations, and documentation.

5. **Preserve what survived.** The GitHub App that the relay worker had used for API authentication was still needed by the classifier worker. We renamed it from its legacy name to something that reflected its actual scope - a shared GitHub App for unattended API access across all venture installations.

The total removal: 19 files deleted, 6,231 lines removed, zero functionality lost.

---

## Why Serverless Monoliths Happen

Serverless platforms make it dangerously easy to add responsibilities to an existing worker. There is no deployment friction. There is no "spin up a new service" cost. You open the file, add a route handler, deploy. Five minutes, done.

This is the serverless equivalent of a god class. In traditional backend development, at least creating a new service involves some ceremony - a new repository, a deployment pipeline, DNS configuration, maybe a load balancer rule. That friction, annoying as it is, creates a natural checkpoint: "Is this really part of this service's responsibility?"

Cloudflare Workers have almost zero deployment ceremony. A new worker is a directory with a `wrangler.toml` and an `index.ts`. Deploying it is `npx wrangler deploy`. There is no infrastructure to provision, no containers to configure, no DNS to manage (Workers get a `*.workers.dev` subdomain automatically). The marginal cost of a new worker is nearly zero.

But we didn't create a new worker. We added a handler to the existing one. Because it was already there, already deployed, already had the secrets configured, already had the D1 binding. The path of least resistance was always "add it to the relay."

This pattern has a name in traditional software engineering: accidental coupling. Features end up in the same deployment unit not because they belong together, but because that is where the code happened to be when someone needed to add something.

---

## What Makes a Good Serverless Worker

After this experience, our heuristic for worker scope is simple: **a worker should have one reason to be deployed.**

The classifier worker gets deployed when classification logic changes - a new prompt version, a new grade level, a change to the skip rules. That is it. Changes to GitHub API interactions, context management, or documentation systems do not require touching the classifier.

The context API worker (our other primary worker) gets deployed when session management, handoff storage, or knowledge store logic changes. It has no opinions about webhook processing or issue classification.

Compare this to the relay worker, which would need redeployment for any change to: GitHub API proxy logic, webhook routing, classification prompts, evidence storage format, retry policies, or the V2 event schema. Six independent reasons to deploy a single worker.

A useful test: can you describe what the worker does in one sentence without using the word "and"? "It classifies GitHub issues" passes. "It proxies GitHub API calls and processes webhooks and classifies issues and stores evidence" does not.

---

## The Broader Pattern

This was not a refactoring project. We did not sit down and say "let us decompose the monolithic worker into microworkers." The decomposition happened organically, driven by actual needs:

- We needed a better classifier, so we built one as a standalone worker.
- We needed direct GitHub access from agents, so we used `gh` CLI.
- We discovered the relay was unreachable, so we deleted it.

The lesson is not "always start with microservices" or "monoliths are bad." The relay worker was the right architecture when it was built. Claude Desktop could not shell out to `gh`. A single worker handling everything was simpler than three workers when the team was small and the feature set was new.

The lesson is: **pay attention to when something stops being called.** If a service's production auth can break without anyone noticing, that service is not serving anyone. Dead code is bad enough in a codebase. Dead infrastructure is worse - it still costs attention, still shows up in dashboards, still creates the illusion that it matters.

The relay worker's D1 database still had tables, still had data. Its R2 bucket still had evidence files. Its Cloudflare dashboard still showed it as a deployed worker. All of that created cognitive overhead every time someone looked at the infrastructure. "What does this do? Is this important? Can I touch this?"

The answer was: it does nothing, it is not important, and yes, you should delete it.

---

## Checklist for Decommissioning a Worker

For anyone facing a similar cleanup, here is the process that worked for us:

1. **Search for references.** Grep the entire codebase for the worker's URL, name, and endpoint paths. Check environment variables, MCP configurations, CI workflows, and documentation.

2. **Check the secrets.** Are the worker's production secrets present and valid? If not, how long have they been missing? (This is a strong signal.)

3. **Check the logs.** What is the worker's request volume? If it is zero or near-zero, that confirms nothing is calling it.

4. **Identify what survives.** Shared resources (like a GitHub App) may be used by other services. Rename them to reflect their actual scope rather than their historical origin.

5. **Delete with confidence.** Remove the worker deployment, the database, the storage bucket, all source files, and all references. Do not comment things out. Do not leave behind "just in case" stubs. Delete.

6. **Verify after deletion.** Run the full CI pipeline. Run agent sessions. Confirm that every workflow that was working before the deletion still works after.

The entire decommission - discovery, verification, deletion, cleanup, and verification - took a single session. That is the reward for clean boundaries: when something is truly unused, removing it is trivial.

---

_We run AI coding agents across multiple projects and machines. Our infrastructure runs on Cloudflare Workers, D1, GitHub, and Claude Code. This article describes a real decommissioning that happened in February 2026._
