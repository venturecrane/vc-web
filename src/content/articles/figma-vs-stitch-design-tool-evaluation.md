---
title: 'A Design Tool Bake-Off - Figma MCP vs Google Stitch'
date: 2026-03-28
description: 'We tested Figma MCP and Google Stitch head-to-head on the same three UI panels. Sixty API calls versus three.'
author: 'Venture Crane'
tags: ['design-tooling', 'mcp', 'agent-workflow']
draft: false
---

We spent 60 minutes testing two AI design tools against the same task. The decision was clear in 20.

We needed three UI panels for one of our products. An AI assist sidebar, a document structure panel, and a metadata form. Real screens, production-bound, with a defined design system.

One tool took 60+ API calls and produced broken output. The other took 3 API calls and produced screens we could ship.

---

## The Setup

Both tools integrate with Claude Code via MCP. That was the shared baseline. We evaluated them on the same criteria: API efficiency, output fidelity, design system integration, text wrapping correctness, setup overhead, and cost.

**Figma MCP** requires a running WebSocket server on `localhost:3055` and a Figma plugin connected to a specific channel. The plugin bridges the agent's MCP calls to the Figma canvas. It also requires a Figma team subscription: $700 per year.

**Stitch MCP** is a CLI-installed package that communicates directly with Google's Gemini-powered design generation API via OAuth. No local server. No plugin. Free tier. Pinned to v0.5.0 - we'll come back to why.

---

## The Figma MCP Test

Setup took longer than expected. The plugin install is straightforward. Getting the WebSocket bridge stable was not. The plugin requires a specific channel ID to pair with the agent's MCP server. If the plugin disconnects mid-session, the entire bridge goes down. We saw this happen twice during the test.

Once connected, we started building the first panel - the AI assist sidebar. Figma MCP works by issuing individual element creation calls: create a frame, set its dimensions, create a text node, position it, set its font size, set its color, create a rectangle, apply corner radius. Each action is a separate API call.

Three panels required 60+ calls.

That number is not surprising once you understand the model. Figma MCP gives agents granular access to Figma's scene graph. Anything you can do in Figma manually, an agent can do via API. The problem is that "manually" in Figma is already verbose - a simple card component might involve 15 nested layers before you add any content.

The output was structurally accurate but had two concrete failures.

First: text wrapping. Long strings in constrained text frames did not wrap - they overflowed or truncated, depending on how the text node's resize behavior was set. Correcting this required additional calls to set `textAutoResize` properties, and even then the results were inconsistent across different frame widths. After three attempts on the sidebar panel, text wrapping in the narrower column still broke at certain viewport sizes.

Second: the plugin crashed under parallel requests. When we issued two element creation calls in close sequence, the plugin's WebSocket queue backed up and produced a malformed canvas state. Subsequent calls landed in the wrong parent frame. Recovering required manually inspecting the Figma canvas, identifying the orphaned layers, and either deleting them or issuing correction calls.

We finished one of the three panels before stopping the test. The time cost of the correction loop made completing all three impractical.

---

## The Stitch MCP Test

Stitch uses a different model entirely. Rather than giving agents granular access to a canvas, it accepts a natural language prompt and returns a complete, rendered screen.

The MCP tool is `generate_screen_from_text`. One call, one screen.

Before generating, we created a design system document at `.stitch/DESIGN.md` - a structured file describing our color tokens, typography scale, component patterns, and spacing conventions. Stitch ingests this at generation time and applies it to the output. We then created a persistent project with a `create_project` call. That project ID lives in our venture registry and persists across sessions.

Three panels, three calls:

```
generate_screen_from_text: "AI assist sidebar with suggestion cards,
  accept/reject controls, and a collapse toggle. Dark surface background,
  14px body text, 8px card radius."

generate_screen_from_text: "Document structure panel showing item
  hierarchy with drag handles and expand/collapse indicators."

generate_screen_from_text: "Item metadata form with title, progress
  target, category selector, and status badge."
```

All three screens rendered correctly. Text wrapping worked. The design system tokens - our specific color values, type scale, and spacing units - were applied throughout. No correction calls. No bridge crashes.

Total time for all three panels: under 10 minutes.

---

## What the Numbers Say

| Metric                    | Figma MCP                 | Stitch MCP              |
| ------------------------- | ------------------------- | ----------------------- |
| API calls for 3 panels    | 60+                       | 3                       |
| Panels completed          | 1 of 3                    | 3 of 3                  |
| Text wrapping             | Broken                    | Working                 |
| Plugin/bridge failures    | 2 crashes                 | 0                       |
| Design system integration | Manual per-call           | Automatic via DESIGN.md |
| Annual cost               | $700 (team plan)          | Free                    |
| Local setup required      | WebSocket server + plugin | gcloud ADC              |

The 60:3 API call ratio matters beyond just speed. Each Figma MCP call can trigger a correction loop. If one element lands in the wrong frame, subsequent calls compound the error. You are not building a screen - you are debugging a scene graph in real time.

---

## What We Did Not Expect

The design system integration was more useful than anticipated. We had expected Stitch to mostly ignore `.stitch/DESIGN.md` and produce generic output. It did not. The first screen came back with our exact color tokens: `#1A1A2E` for the dark surface, our specific `Inter` weights, our card border radius. The document is not just metadata - Stitch treats it as binding constraints.

We also did not expect the persistent project feature to matter much. It does. When you return to a project in a subsequent session, Stitch has context about the screens already generated. You can issue `edit_screens` calls that reference prior output without re-specifying the design system constraints. This makes iterative work materially faster.

The failure mode we did not anticipate was version sensitivity. Stitch v0.5.1 has a broken MCP stdio handshake - the process starts but the tool never registers with the Claude Code session. We hit this on the first install attempt. The fix was pinning to v0.5.0: `npx @_davideast/stitch-mcp@0.5.0 init -c cc`. We have since locked this version in our tooling. Anyone adopting Stitch needs to know this before they start.

The other setup wrinkle: Stitch authenticates via Google Cloud application default credentials, not API keys. Running `gcloud auth application-default login` is required on each machine before Stitch works. This is a one-time step per machine, but it is not obvious from the documentation. It also differs from every other MCP tool in our stack. Fleet machines need both `gcloud auth login` and `gcloud auth application-default login` - two separate credential stores, both required.

---

## The Decision

We removed Figma MCP from `.mcp.json` the same day.

The 60+ call overhead is not a quirk to work around - it is the architecture. Figma MCP is designed for granular programmatic control of a Figma canvas. That is the right tool for agents that need to maintain a living design file, push design tokens, or sync with a developer handoff workflow. It is the wrong tool for generating high-fidelity screens from prompts.

We do not maintain living Figma files. We generate screens for wireframe review, iterate on them, and hand them to the React components agent. Stitch fits that workflow. Figma MCP does not.

After the bake-off, we created persistent Stitch projects for the ventures where design work is active and added the project IDs to our venture registry. The project ID field is now standard in the registry. We updated the enterprise wireframe guidelines and design system docs to reflect Stitch as the sole design tool.

The same day, the dev agents on one of our product ventures built a `/design` skill that codifies Stitch into a repeatable pipeline. The workflow runs: problem definition, a three-agent UX review panel (UI/UX designer, product manager, user representative), Stitch screen generation using the review output as the brief, a visual review loop with the Captain, approval, implementation, visual QA, and ship. Every UI feature now starts with Stitch screens that the Captain approves before any code is written. Deviations from the approved design are treated as bugs.

The skill took one session to build. It would not have been practical with Figma MCP - the 60-call overhead per screen makes a review-iterate-regenerate loop too expensive to run repeatedly. With Stitch, regenerating a screen after feedback is one call.

---

## Practical Recommendations

If you are evaluating AI design tools for an agent workflow, the use case determines the answer.

**Agents manipulating a shared Figma canvas** - syncing tokens to a design system, maintaining a component library, generating developer handoffs - should use Figma MCP. The granular API control is a feature, not a bug, for that use case.

**Agents generating screens from prompts** should use Stitch. The prompt-to-screen model produces better output in fewer calls, design system integration is automatic, and the free tier removes the $700 barrier entirely.

The setup cost for Stitch is real. Pinning to v0.5.0, configuring gcloud ADC, creating a `.stitch/DESIGN.md` - plan for 30 minutes on first setup per machine. After that, generating a screen takes a single MCP call.

For most agent workflows generating UI from descriptions, 3 calls beats 60. The math is not close.
