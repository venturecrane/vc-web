---
title: 'Dropping categories for tags-only knowledge taxonomy'
date: 2026-02-07
tags: ['infrastructure', 'architecture']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We dropped the category column from our enterprise knowledge store and switched to a tags-only model. One day after shipping five hardcoded categories, we ripped them out.

## What We Did

The initial knowledge store schema required every note to have exactly one category from a fixed list: log, reference, contact, idea, or governance. Tags existed as a secondary classification. In practice, this created friction - notes that were both strategic and governance-related had to pick one, and adding a new type meant a schema migration.

The consolidation dropped the category column entirely. Tags became the only structural classification, stored as a JSON array. A recommended vocabulary covers the common types (executive summaries, PRDs, design briefs, strategy, methodology, market research, bios, marketing, governance), but new tags can be added without code changes or database migrations.

The schema migration was straightforward - create a new table without the category column, copy data over, drop the old table, rebuild indexes. The MCP tools simplified: no more category parameter in the API, just tags and free-text search.

The bigger change was consolidating executive summaries. These per-venture overviews had been living in both git (as markdown files) and D1 (synced via a shell script). We killed the git-to-D1 pipeline and made the notes table the single source of truth. Executive summaries are now just notes tagged `executive-summary`, queried by the session startup flow like any other note.

The cleanup removed the upload script, the GitHub Actions sync workflow, and the enterprise docs directory from git. Seven files deleted.

## What Surprised Us

The categories had only existed for a day, but they'd already shaped the MCP tool interface, the CLAUDE.md documentation, and the agent prompts. Ripping them out touched 15 files across the worker, MCP package, and documentation. The lesson: schema decisions propagate fast, even in a one-person operation. The cost of undoing a bad abstraction scales with how many systems consume it, not how long it's been in place.
