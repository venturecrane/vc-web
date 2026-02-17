---
title: 'Decomposing agent instructions into a routing table'
date: 2026-02-16
tags: ['agent-architecture', 'infrastructure']
draft: false
---

Our primary agent instruction file had grown to ~200 lines and ~2,500 tokens. Every session loaded the entire thing - secrets management procedures, fleet operations runbooks, content editorial policy - regardless of whether the session touched any of those domains. A session fixing a TypeScript bug loaded the same instructions as a session publishing an article. The file had become a monolith.

## What We Did

We decomposed the instruction file into a routing table plus three fetchable modules. The routing table stays small - 86 lines, ~600 tokens - and loads in every session. Each row has a module name, one inline key rule (the single most important directive for that domain), and a fetch pointer that tells the agent how to load the full instructions on demand.

The three modules cover secrets management, content editorial policy, and fleet operations. Each contains the detailed procedures that previously lived in the monolithic file. An agent working on a deployment pulls the fleet operations module. An agent drafting content pulls the editorial module. An agent that never touches either domain loads neither.

The inline key rules matter. Without them, an agent that doesn't load a module has zero guidance for that domain. With them, the agent has enough context to either handle simple cases directly or recognize that it needs the full module. "Verify secret VALUES, not just key existence" is a one-liner that prevents the most common secrets mistake even when the full secrets runbook isn't loaded.

We also deleted the slash commands table from the instruction file. The slash command system has its own discovery mechanism - agents enumerate available commands at runtime. Maintaining a static reference was duplicate state that would drift.

A CI workflow auto-syncs module edits to the document store on push to main. Authors edit markdown files in the repo; the pipeline publishes them where agents can fetch on demand. No manual upload step.

Finally, we added a governance directive to the agent's persistent memory file: domain-specific knowledge belongs in modules, not in always-loaded memory. Without this, the agent's learning loop would gradually re-accumulate domain knowledge into session context, defeating the decomposition. The directive makes the boundary explicit - memory is for cross-cutting discoveries, domain knowledge routes through the module system.

## What Surprised Us

The decomposition itself was straightforward. Identify domains that don't overlap, extract them into fetchable documents, leave a one-line summary and a fetch pointer. Standard refactoring. The part that needed actual design was the governance.

Agent instruction files have a natural ratchet: every domain that adds instructions increases the cost of every session, including sessions that don't need those instructions. Breaking the coupling with fetchable modules solves the structural problem, but agents that learn from their sessions will write new knowledge back into always-loaded context unless you tell them not to. The monolith grows back. The governance directive - a single paragraph explaining where new domain knowledge goes - is what makes the decomposition durable.

Adding a fourth module in the future will cost one table row (~20 tokens), not the full module content. That's the real win. The 75% reduction in always-loaded tokens is the immediate payoff, but decoupling session cost from domain count is the structural one.
