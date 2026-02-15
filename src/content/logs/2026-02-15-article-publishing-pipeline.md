---
title: 'Building an editorial pipeline for practitioner content'
date: 2026-02-15T10:00:00
tags: ['content', 'process']
draft: false
---

> **Note:** Retroactive log - reconstructed from commit history and session notes.

We shipped a five-state publishing pipeline with a two-agent editorial review system. The first article went live, then 14 more went through batch editorial review in a single session.

## What We Did

The pipeline tracks articles through five states: candidate (issue filed), draft (markdown created, writing in progress), review (editorial check passed, awaiting founder review), approved (founder signs off), and published (live on the site, issue closed). Labels on the issue tracker mirror the state transitions.

The editorial review is a slash command that spawns two agents in parallel. The first is a style and compliance editor - it checks every line against a terminology reference document, flags internal names that leaked into published prose, catches manufactured experience patterns ("we discovered that simplicity matters"), and reports mechanical issues like em dashes. The second is a fact checker - it cross-references claims against the venture registry, verifies numbers against build logs, checks whether solved problems are still described as current limitations, and flags contradictions with other published articles.

Both agents report blocking issues (must fix) and advisory issues (needs judgment). The command auto-fixes blocking violations and mechanical advisory fixes directly in the article file. Advisory issues that need human judgment - tone adjustments, architectural description rewrites - get surfaced in a report.

The first article published was a technical deep-dive on the context management system. It went through the full pipeline: drafted, reviewed by both agents, founder review, published. Then we ran the editorial command against 14 draft articles in batch. The style editor caught internal worker names, specific machine counts, real venture codes in examples, and unnamed tool references. The fact checker caught wrong CSS values, an incorrect line count, and a specification error. A follow-up pass resolved 9 more advisory items flagged for human review.

A terminology reference document serves as the source of truth for both agents. It defines canonical names, genericization rules for published content (internal project names become functional descriptions, venture names become generic labels), and style rules. When the terminology doc is wrong, you fix it there - not in the articles.

## What Surprised Us

The batch editorial pass revealed how consistently certain patterns leak into drafts. Internal worker names appeared in 6 of 14 articles. Specific venture counts ("five ventures") appeared in 4. The agents had written these drafts knowing the genericization rules existed, but the rules weren't enforced at draft time - only at review time. The editorial pipeline catches what the drafting process misses, which is exactly why it exists as a separate step rather than a drafting constraint.
