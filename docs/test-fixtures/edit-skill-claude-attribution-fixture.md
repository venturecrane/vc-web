---
title: '[FIXTURE] Claude Attribution Edit-Skill Test Fixture'
description: Deliberate violations for smoke-testing /edit-article and /edit-log Claude attribution checks. Not for publication.
pubDate: 2026-04-22
draft: true
testFixture: true
excludeFromBuild: true
tags: ['test-fixture']
---

# [FIXTURE] Claude Attribution Edit-Skill Test Fixture

This file is a deterministic test fixture. It contains exactly three violations of the Claude Attribution rules in `docs/content/terminology.md`. Running `/edit-article` or `/edit-log` on this file should produce exactly three findings: two BLOCKING and one ADVISORY. Do not edit the violations below without updating the smoke-test expectations in the skill plan doc.

## Violation 1 - Partnership overclaim (BLOCKING)

As a Claude Certified Partner, we deliver operational consulting to Phoenix small businesses with Claude-powered lead qualification and delivery tooling.

Expected finding: BLOCKING. "Claude Certified Partner" misstates certification. Canonical form per terminology.md Section 1 is "in the Claude Partner Network" or "pursuing Partner Network status." Auto-fix: not applied (rewrite is human-review only).

## Violation 2 - Tool attribution conflation (BLOCKING)

We used Claude Code to score leads in the review-mining pipeline, tuning the sonnet-class model over a weekly cadence.

Expected finding: BLOCKING. Per the venture-to-integration mapping in terminology.md Section 3, SS review-mining uses the Claude API (direct HTTP), not Claude Code (the CLI harness). The sentence describes a production cron worker call, which is Claude API by definition. Auto-fix: "Claude Code" -> "the Claude API."

## Violation 3 - Generic AI-agent language in clear CC CLI context (ADVISORY)

Before any agent session begins, the AI coding CLI loads the CLAUDE.md file at the repo root and every `.claude/rules/` match for the files the session will touch. The agent then reads the venture registry and joins the fleet via crane-mcp.

Expected finding: ADVISORY. The paragraph describes concrete Claude Code work (CLAUDE.md, `.claude/rules/`, crane-mcp integration). The retrofit heuristic in terminology.md Section 4 does not apply: this fixture's title contains "Claude Attribution" so heuristic question 1 answers YES (a Claude-specific framing). Suggestion: "the AI coding CLI" -> "Claude Code." Not auto-fixed.

## Control passage (no findings expected)

Our development layer runs on Claude Code across every venture. The pattern is consistent: a Claude Code session reads CLAUDE.md, loads path-scoped rules, and dispatches to fleet machines via crane-mcp. When we need production-scale inference outside the development layer, we call the Claude API directly from Cloudflare Workers cron jobs.

Expected: no findings. Accurate attribution throughout; canonical tool terms for each layer.
