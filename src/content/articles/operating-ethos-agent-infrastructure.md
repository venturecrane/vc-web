---
title: 'Shipping a Cultural Directive Your Agents Read at Session Start'
date: 2026-04-22
description: "Captain's standing order kept getting forgotten. The fix: commit it to a file agents read at session start - and learn what text belongs there."
author: 'Venture Crane'
tags: ['agent-context', 'agent-operations', 'process']
draft: false
---

The Captain had a standing order. Agents kept forgetting it.

The framing was "a wild band of AI agents with an ape commander" - an intentionally irreverent way of naming the operating reality: autonomous execution within a clear mission, not corporate process theater. The problem was that each agent session started cold. The briefing loaded venture state, open alerts, fleet health, cadence items. It did not load the culture. Agents would drift toward caution, ask instead of move, hedge instead of decide. The standing order existed in the Captain's head. Not anywhere an agent could read it.

On April 20, that changed. `docs/instructions/operating-ethos.md` landed as a committed file - 107 lines, pushed through the normal PR process, CI green, squash-merged as `ea350da`. It is now part of the repo. Every session-start briefing surfaces a summary of it. Agents read it before their first tool call.

## What goes in an ethos doc versus a guardrails doc

This distinction matters. Both files shape agent behavior. They do it through different mechanisms.

Guardrails are prohibitions. They define hard stops: actions that require Captain sign-off before proceeding, schema changes that cannot be made unilaterally, features that cannot be removed without a directive. The content in guardrails reads like a compliance checklist because that is what it is. An agent that reads guardrails learns what not to do.

An ethos doc is different. It sets the frame for how to do everything else. The operating ethos opened with the standing order verbatim, then explained the distinction the Captain keeps making in practice: the difference between bureaucracy and legitimate safety rails. Bureaucracy is asking for approval before starting a straightforward task. A safety rail is the requirement to escalate before dropping a production schema. The ethos names this line explicitly because agents need to locate themselves on it in real time, in situations the document could not have anticipated.

The ethos also contains a bureaucracy-vs-safety distinction table and cross-references to patterns the Captain has reinforced over multiple sessions - the kill-don't-file feedback, no-human-ergonomics arguments, critique-deference behavior. These are not rules. They are calibration - the accumulated judgment about what good execution looks like, written down so it does not have to be re-taught every session.

## Why version control is the right home for this

The alternative is prompt engineering. Inject the standing order into the SOS tool call, hardcode it in every agent's system prompt, repeat it in every handoff. That works until the framing evolves, at which point you are chasing instances across a codebase you cannot grep completely.

Committing the ethos to a file means one source of truth. When the framing changes, one file changes. The PR that merged `ea350da` also updated the whitelist in `scripts/upload-doc-to-context-worker.sh`, which uploads the file to the context worker on future rebuilds. From there, the session-start briefing pulls it via `crane_doc('global', 'operating-ethos.md')`. The flow is: edit the file, run the rebuild, and the next agent session picks up the new framing without any other changes.

There is also something meaningful about the review process. Putting culture in a file means culture gets a PR, a diff, a CI check. It can be challenged, revised, and traced via `git log`. When the Captain updated the ethos two sessions later - adding a "Your Kit, Your Confidence" section naming the behaviors the full toolkit licenses - that landed as PR #581 with a documented rationale: agents were under-using what they already had. Working serially when sub-agents would parallelize. Skipping tool calls they had access to. The PR body explained the design choice: no specific model names or tool catalogs hardcoded, because those rot. Framing stays, inventory lives in `tooling.md`.

That is a conversation visible in the commit history. If the framing evolves again, there will be another diff, another rationale, another `git blame` entry.

## What the inlined SOS paragraph does

The ethos doc is long-form. Agents do not read 107 lines on every SOS call. The actual behavior-shaping mechanism is an inlined paragraph at the top of the Directives block in the session-start tool.

When an agent calls `crane_sos`, the briefing it receives includes this paragraph before the rule list. It frames the rules. It tells the agent what kind of operator it is working with and what kind of work is expected. The rules then read in context rather than as a flat list of constraints.

The capability-and-confidence update in PR #581 extended this paragraph with explicit framing around the toolkit: parallelize when you can, hold systems in context, verify end-to-end, reach for the right tool first. Not a capability inventory - that ages poorly. A set of behaviors that survives model and tool churn.

The design choice worth naming: the SOS paragraph is deliberately redundant with the full doc. An agent in a session where `crane_doc` retrieves the full ethos gets the long version. An agent that never explicitly loads the doc still gets the framing via SOS. The paragraph is a minimum viable read; the doc is the elaboration.

## What this does not solve

The ethos is a file. Files do not enforce themselves.

An agent that reads "no timidity" at session start and then hedges on every tool call has not absorbed the directive - it has read past it. The only observable evidence that the framing is working is session behavior over time: fewer permission requests on straightforward tasks, more parallel tool calls, more end-to-end verification instead of declared-done handoffs. The handoff that shipped PR #581 flagged this explicitly: "Observe whether the new ethos directive actually changes agent behavior. The update is worthless if agents keep working serially and timidly."

There is also a cold-start problem. After a deploy, the session-start MCP server on a given machine still has the old build in memory until restarted. Fleet agents dispatched after the deploy see the new version immediately. Local sessions on machines that have not restarted see the old one. This is not special to the ethos - any change to the SOS tooling has the same delay. But it means the "shipped" moment and the "all agents see this" moment are different points in time.

## When this pattern applies

Shipping culture-as-prose to a file agents read at session start makes sense when:

The directive recurs. If the Captain says the same thing across five sessions, it belongs in the ethos. If it is specific to one session or one venture, it belongs in the handoff.

The framing is stable. The ethos should not be a changelog. If the content changes every week, agents accumulate context debt as they load stale versions from memory. The distinction table and the bureaucracy-vs-safety framing in the operating ethos have not changed since they landed. The toolkit confidence framing was an addition, not a replacement.

The directive is about how to work, not what to work on. Priorities, sprint targets, open PRs - those are SOS briefing content, updated continuously. The ethos is the thing that stays the same across all of those contexts.

When those conditions hold, committing the directive to a versioned file - with a PR, a diff, and a path from the file to the session-start briefing - is the right infrastructure. Not because of what it does in any single session, but because of what it builds over time: a record of how the operation was supposed to run, legible to every agent that ever starts a session here.
