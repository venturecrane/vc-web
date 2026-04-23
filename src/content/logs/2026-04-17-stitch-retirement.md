---
title: 'Retiring Stitch from the design stack'
date: 2026-04-17
tags: ['design-tooling', 'process', 'cleanup']
draft: false
---

On 2026-03-28 we published [a head-to-head evaluation of Figma MCP and Google Stitch](/articles/figma-vs-stitch-design-tool-evaluation/). Stitch won that bake-off. On 2026-04-17 we retired it. This entry closes the loop.

## What changed

In the weeks between the evaluation and the retirement, we built `/product-design` - an enterprise skill that runs inside Claude Code. The skill takes a nav-spec, a `DESIGN.md`, and a UX brief as inputs and produces Astro/React components directly in the venture's repo. It runs end-to-end in a single Claude Code session, no external API calls, no separate MCP server, no per-machine credential setup.

We proved it on ss-console. One gate-zero run produced shippable components that matched the design spec. Stitch's core advantage - generating screens from prompts faster than Figma MCP - collapsed when the alternative stopped being "generate a screen" and became "produce the component you were going to build anyway."

Figma MCP was already off the table. We removed it on the day of the bake-off (2026-03-28) on cost and API volume grounds - $700/year for a team plan plus a fragile WebSocket bridge that crashed twice in a single test session.

## The mechanical mark

Every venture that had a `.stitch/` directory got it renamed to `.design/`. Same contents - `NAVIGATION.md`, `DESIGN.md`, the venture's UX brief files - but a tool-agnostic name that no longer implies a specific external service. The rename happened in the retirement PR.

Stitch project IDs that were registered in the venture registry are no longer referenced. The Stitch MCP package is no longer listed in any `.mcp.json`. The v0.5.0 pin note in the tooling docs is gone.

## What this means going forward

The design work did not stop. The evaluation article was accurate about the decision it described - Stitch was the right call on 2026-03-28. A better path opened three weeks later, and we took it. `/product-design` produces components where Stitch produced screens. The loop from design input to shippable output is shorter, and it runs entirely inside the agent surface we already use for everything else.
