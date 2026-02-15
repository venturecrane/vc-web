---
title: 'Decommissioning the legacy webhook worker'
date: 2026-02-11
tags: ['infrastructure', 'cloudflare']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We deleted the legacy webhook worker, a 3,234-line Cloudflare Worker that had been the backbone of our GitHub integration since early builds. It's gone - the worker, the D1 database, the R2 bucket, all of it.

## What We Did

The legacy webhook worker started as a simple HTTP bridge: Claude Desktop couldn't call the GitHub API directly, so we built a Worker to proxy those calls. Over time it grew V1 endpoints (comment, labels, close, merge), a V2 event system that never got fully adopted, webhook processing, and a grading pipeline. By February 2026 it was 3,234 lines of TypeScript doing four different jobs.

Two things made the decommission possible. First, the GitHub classifier took over webhook processing and issue grading as a clean, single-purpose worker. Second, we moved to running `gh` CLI commands directly from agent sessions instead of proxying through HTTP - once Claude Code could shell out, the relay pattern was unnecessary overhead.

The kill signal was discovering that the worker's production deployment was missing its auth tokens. Its API endpoints were non-functional in prod and nothing in the codebase referenced its URL. No MCP tools, no scripts, no slash commands. It was already dead; we just hadn't cleaned up the body.

The decommission removed 19 files and 6,231 lines across the monorepo. We deleted the production and staging workers from Cloudflare, the relay D1 database, and the evidence R2 bucket. References were cleaned from `package.json`, CI workflows, security configs, and documentation.

The GitHub App survived - we renamed it to reflect its broader role since the GitHub classifier still uses it for unattended API auth across multiple venture installations.

## What Surprised Us

The biggest surprise was that prod had been broken for an unknown period. The missing auth tokens meant any external call to the worker would have failed, but nobody noticed because nothing was calling it. We'd already migrated away without realizing we'd migrated away. The lesson: if you can't tell when something breaks, you can't tell if you need it.
