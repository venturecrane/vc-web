---
title: 'Six Articles in One Session: A Parallel Content Sprint'
date: 2026-04-22
tags: ['content', 'agent-operations', 'parallel-execution']
draft: false
---

On 2026-04-22, we drafted, reviewed, and shipped six articles to venturecrane.com in a single session. Six agents ran in parallel, each working an isolated git worktree on a dedicated branch. Each article went through `/edit-article` editorial review before a PR was opened. All six PRs merged on 2026-04-23 as #97 through #102.

This is the operational record of how that ran - what was actually parallel, what wasn't, and what the constraint surface looks like at this scale.

## The setup

The sprint used a six-agent team. Each agent was assigned one article topic at session start and worked exclusively on that topic for the duration. Parallel worktrees meant no branch contention: agents wrote to independent directories and opened independent PRs without coordinating on file state.

The parallelism was real but bounded. Three things each agent had to do sequentially, not in parallel with each other:

**Terminology doc read.** Every agent started by reading `docs/content/terminology.md` before drafting. This is not skippable - it carries the Claude attribution rules, the stealth venture check, the infrastructure name genericization table, the banned terms. The doc is short enough to read once, but it has to be read. Agents that skip it produce content that fails `/edit-article` review, which costs more time than the read did.

**Stealth venture check.** Each agent had to confirm which ventures are visible in published content by reading the portfolio config. All ventures are currently stealth - none have passed `/go-live`. The practical effect is that no specific venture can be named in these articles. Articles that touch venture work reference "a venture" or describe the pattern without the proper name.

**`/edit-article` review.** This runs as a separate agent pass after the draft is complete. It catches stealth names, Claude attribution errors, banned terms, and genericization gaps that the drafting agent introduced. It is not a light pass - three of the six articles came back with blocking findings that required revisions before the PR could open.

## What ran in parallel

Everything else. Six agents drafted simultaneously. Six PRs were opened in the same window. The PR descriptions, the frontmatter, the body copy - all of that was concurrent work across six isolated worktrees. The GitHub reviewer queue received all six within a short window.

The six articles cover a wide range: a Claude Code plugin fleet rollout, an operating ethos committed as a file, a behavioral directive turned into a slash command, a partner network application from a solo operator, a private npm registry migration, and a skill catalog retirement. No two share a primary topic. That was deliberate - content diversity eliminates the main failure mode of parallel content sprints, which is agents who are nominally working independently but end up producing five variants of the same argument because they shared a brief.

## The editorial layer

`/edit-article` is the gate before any article touches a PR. The sprint put this under real load: six editorial reviews running in sequence after six drafts completed. The skill checks Claude attribution against the terminology lexicon, runs the stealth venture test against `config/ventures.json`, and flags any infrastructure name that should have been genericized in published content.

This is also where the sprint's main quality bet lives. Drafting agents operate under task pressure. They know the topic, they've read the terminology doc, but they are optimizing for a complete draft. Editorial review is the context shift that catches what the drafting pass misses - not because drafting agents are careless, but because a fresh read is structurally different from the read that produced the draft.

All six articles cleared editorial review and are published. One UTC-stamping bug on the `date:` field was caught post-merge and corrected in a follow-up PR (#103).

## What this proves

Six articles in one session is not a throughput claim. It is a confirmation that the parallel worktree pattern scales to content work, not just code. The constraint surface is small: shared context reads at the start, an editorial pass per article at the end, no shared state in between. The work in the middle is embarrassingly parallel.

The articles that shipped are their own argument for whether this model produces quality work.
