---
title: 'July in review: platform hygiene'
date: 2026-07-31
tags: ['infrastructure', 'process', 'mcp', 'agent-operations']
draft: false
shipped: 'Schema-parity guard for MCP tools; hosted cloud MCP surfaces retired; orphan-worktree lock parsing fixed; session-close dispatcher brought current and all 37 skill dispatchers to parity; memory approval gate un-inverted; memory capture restored to session close'
---

_Retroactive log covering July 1-31, 2026, written September 14, 2026. Reconstructed from merged pull requests, incident records, and session notes._

Almost everything that shipped in July was a repair to a seam where two copies of the same fact had drifted apart. None of it was new capability.

## Tools advertised schemas they did not implement

Three tools on the local MCP server advertised an input schema that differed from the one they validate against. The drift surfaced the ordinary way: an agent reported to the Captain that a handoff tool had no parameter for writing a non-final handoff, when the tool had carried that parameter for months. The advertised schema had never learned about it, and the advertised schema is what every agent sees.

Fixed all three, and added the guard that makes the class non-silent: sixty-three tests comparing advertised properties and required-lists against the validation schemas for every tool, with the tool set pinned by equality so a new tool cannot escape the comparison by being new.

## The hosted cloud MCP surfaces came out

Both cloud-facing MCP surfaces were removed, leaving the local server every command-line agent already used. Sixty-two files, about ten and a half thousand lines.

The reason is that the remote-control path now drives a live command-line session from web or mobile, which gives cloud clients the full local tool surface rather than the hosted subset one of those workers was built to approximate. Runtime evidence at removal: twenty-eight requests in thirty days to the OAuth-facing worker, zero subrequests, zero durable object invocations, an empty cache namespace. The traffic was health probes. No session had ever run on it.

Standing cost removed with it: several open dependency-bump pull requests, four CI matrix jobs per push, a hundred and ninety-nine packages on every clean install, and a failing connector line in every command-line session.

## The orphan-worktree backstop had stopped backstopping

The worktree cleanup tool parses the lock file a session writes when it claims a worktree. Its pattern required one spelling. The harness writes another, with a different noun and a trailing timestamp before the closing parenthesis.

A lock it cannot parse classifies as foreign, which routes the worktree to manual review and skips the live-process triage entirely. So every real lock was exempt from triage, and the backstop had been inert. Observed live: a session reported four locked worktrees and cleaned none, and during that same session one of the holding processes died, leaving its worktree locked and unattended with uncommitted work in it.

Every test fixture used the synthetic spelling. The tests had been describing the parser's own assumption back to it. Fixtures now carry the real spelling; restoring the old pattern against them fails six cases.

## Two session skills were a major version stale

The command-line dispatcher for the session-close skill was two hundred and forty normalized lines behind its source, missing the entire close-out audit and the reachability gate that had shipped in June. The harness dispatches from that file, so neither had ever run in a command-line session. The parity linter could not catch it because it only checked that the file existed.

Fixed the three every-session skills, taught the linter to compare normalized bodies, then brought all thirty-seven skill dispatchers to parity in a follow-up. Repo-wide dispatcher warnings went from fifty-four to zero. Telemetry directives landed across the board at the same time, which is why the ninety-day invocation counts for those skills had been so low: the directive only existed on one of the two dispatch paths.

## The memory gate was inverted

Records the Captain had explicitly approved could not surface at session start until an automated curator independently concurred, while an unapproved curator-promoted record surfaced immediately. Captain approval was decorative.

The gate now admits a stable record when the curator marked it injectable or the record carries approval, with approval as the sovereign override. An unknown gate value used to fall through every check and admit everything stable, which is gate-off; it now resolves to the strictest mode.

Separately, the capture step that is the only path to an approved record at creation existed in the governance document and not in the skill. It was restored to session close, capped at two proposals, folded into the existing close-out question so the session still asks once.

## What surprised us

Almost every defect here was invisible to a green build. The schema drift, the stale dispatcher, the unparsed lock format and the inverted gate all had passing tests written against the same assumption the code made. The tests were not wrong about the code. They were wrong about the world, and agreeing with the code is what let them stay that way.
