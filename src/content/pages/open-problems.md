---
title: 'Open Problems'
updatedDate: 2026-02-16
---

AI-native development is a young discipline. We've solved some problems well enough to write about them. These are the ones we haven't. We publish them because hard problems get solved faster when more people are looking at them.

---

## Current Experiments

Things we're actively testing with specific approaches. We don't know if they work yet.

**Cross-session learning.** Agents start every session cold. [Handoffs](/the-system/) carry forward what happened, but not what was learned. We're testing structured memory files that accumulate debugging insights, codebase patterns, and user preferences across sessions. The open question: how do you grow a memory store without it eventually consuming more context than it saves?

**Multi-venture drift detection.** Four ventures share infrastructure patterns, but drift creeps in silently. We're building automated audits that compare dependency versions, CI configurations, and architectural patterns across repos. The measurement: how many divergences exist today, and how many get caught before they cause a production issue?

---

## Unsolved Problems

Things where we don't know the right approach. These map to real limitations in how we work.

**Agent cost attribution.** We know the [total monthly cost](/articles/what-ai-agents-actually-cost/). We don't have good per-venture or per-feature tracking. When AI subscriptions are flat-rate and agents work across repos in a single [session](/the-system/), attributing cost to the work that generated it is genuinely hard.

**Debugging agent reasoning failures.** When an agent produces wrong output, the failure mode is opaque. Was it a [context](/the-system/) problem (wrong information available), a reasoning problem (right information, wrong conclusion), or a prompt problem (ambiguous instructions)? We don't have reliable ways to distinguish these after the fact.

**Graceful degradation under context pressure.** Long sessions accumulate context until the window compresses older messages. The agent doesn't know what it forgot. We don't have a good pattern for detecting when context compression has dropped critical information and the agent should stop rather than continue with partial memory.

**Sharing agent-native context with new contributors.** The entire system assumes one person with full context. Adding a second contributor - even part-time - means solving how to share session history, operational knowledge, and decision context without requiring them to read everything. Traditional onboarding docs don't cover "here's what the agents know."

**Testing agent workflows end-to-end.** We test the code agents produce. We don't test the workflows they execute. A session that runs the right commands in the wrong order, or skips a verification step, produces no test failure - just a bad outcome. Workflow-level testing for agent operations doesn't have good patterns yet.

---

If any of these problems are ones you're working on too, we'd like to hear about it - whether that's a blog post about your approach, a conversation about what you've tried, or something more collaborative. [Get in touch](/contact/).
