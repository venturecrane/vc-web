---
title: 'Moving enterprise context from Apple Notes to D1'
date: 2026-02-06
tags: ['infrastructure', 'mcp']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We moved our enterprise knowledge store from Apple Notes to a D1-backed database with MCP tools, making venture context accessible from any machine in the fleet.

## What We Did

Every agent session starts by loading context about the venture it's working on - executive summaries, strategic notes, governance docs. The original source was Apple Notes, accessed through an MCP server. It worked on one machine. It didn't work when sessions ran on other machines in the fleet, and it didn't work when MCP timeouts blocked access during startup.

The fix was a proper database. We added a notes table to our D1 instance with fields for title, content, tags, venture scope, and metadata. Two MCP tools give agents read/write access: one for creating and updating notes, another for searching by venture, tag, or free text. The API supports cursor-based pagination and soft deletes.

The initial schema used a fixed category system with five hardcoded types (log, reference, contact, idea, governance). Each note got exactly one category. Tags existed as a secondary classification but felt redundant alongside categories.

Executive summaries - the per-venture overviews that agents load at session start - migrated from markdown files in git to tagged notes in D1. This eliminated a sync pipeline that had been pushing documents from git to D1 via a shell script and GitHub Actions workflow. The notes table became the single source of truth.

The implementation added 1,481 lines across 12 files: D1 migration, five worker endpoints (create, list, get, update, archive), two MCP tools, and a test suite.

## What Surprised Us

Apple Notes wasn't fully replaced - it was downscoped. Personal content (family, recipes, hobbies) stayed in Apple Notes. Enterprise context moved to D1. The boundary turned out to be clean: if an agent needs it at startup, it belongs in the database. If it's personal, it stays local. We'd been mixing the two in one tool and wondering why context loading was unreliable.
