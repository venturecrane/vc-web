---
title: 'Staging environments for agent infrastructure'
date: 2026-02-15
tags: ['infrastructure', 'deployment']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We split our Cloudflare Workers into staging and production environments, added a CI/CD pipeline with automated staging deploys and a manual production gate, and wired up environment-aware agent configuration.

## What We Did

The work followed an architecture decision record across four phases over two days.

**Phase 1** split each worker into two Cloudflare environments using native wrangler.toml environment blocks. Staging became the default deploy target - `npm run deploy` hits staging, `npm run deploy:prod` requires the explicit flag. Each environment got its own D1 database. We ran all existing migrations against the staging databases to bring them to schema parity.

**Phase 2** added a GitHub Actions deploy pipeline. When CI passes on main, the workflow auto-deploys both workers to staging in parallel, then runs smoke tests - health endpoint checks and a D1 connectivity probe that actually queries the database. Production deployment requires a manual trigger through the GitHub Actions UI. No code reaches production without someone explicitly promoting it.

**Phase 3** restructured secrets management. Production secrets moved to a dedicated environment, with staging getting its own distinct infrastructure keys. External service credentials (API keys for third-party services) are shared between environments, but internal auth tokens are isolated - a staging agent can't accidentally authenticate against production.

**Phase 4** added an environment toggle so agents know which environment they're targeting. The session startup display now shows "Environment: staging" or "Environment: production" alongside the API URL. All MCP tools respect the toggle, routing requests to the correct worker. For ventures without staging infrastructure, the launcher falls back to production with a warning rather than failing.

A supporting script mirrors production data into staging for realistic testing - exports all tables, handles D1's 100KB statement limit with a per-row fallback, and verifies row counts after import.

## What Surprised Us

Change detection in the CI pipeline was trickier than expected. The deploy workflow triggers on a `workflow_run` event (after CI succeeds), which checks out the merge commit rather than the PR head. Comparing against `HEAD~1` to detect which workers actually changed required setting git fetch depth to 2 - a one-line fix that took longer to diagnose than to implement. Without it, every merge deployed every worker regardless of what changed.
