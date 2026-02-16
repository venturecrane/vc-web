---
title: 'Open Problems'
updatedDate: 2026-02-16
---

AI-native development is a young discipline. We've solved some problems well enough to write about them. These are the ones we haven't.

---

## Current Experiments

**Cross-session learning.** Agents start every session cold. Handoffs carry forward what happened, but not what was learned. We're experimenting with structured memory files that accumulate debugging insights, codebase patterns, and user preferences across sessions - without ballooning context.

**Multi-venture drift detection.** Four ventures share infrastructure patterns, but drift creeps in. We're building automated audits that compare dependency versions, CI configurations, and architectural patterns across repos and flag divergence before it becomes technical debt.

**Content distribution pipeline.** Publishing articles is manual. We're testing a pipeline from draft to newsletter to social distribution that an agent can execute end-to-end, with human review gates at the content stage rather than the distribution stage.

---

## Unsolved Problems

**Agent cost attribution.** We know the total monthly cost. We don't have good per-venture or per-feature cost tracking. When AI subscriptions are flat-rate and agents work across repos in a single session, attributing cost to the work that generated it is genuinely hard.

**Debugging agent reasoning failures.** When an agent produces wrong output, the failure mode is opaque. Was it a context problem (wrong information available), a reasoning problem (right information, wrong conclusion), or a prompt problem (ambiguous instructions)? We don't have reliable ways to distinguish these after the fact.

**Graceful degradation under context pressure.** Long sessions accumulate context until the window compresses older messages. The agent doesn't know what it forgot. We don't have a good pattern for detecting when context compression has dropped critical information and the agent should stop rather than continue with partial memory.

**Onboarding a second human.** The entire system assumes one person with full context. Adding a second contributor - even part-time - requires solving role boundaries, permission models, and context sharing problems we haven't faced yet.

**Testing agent workflows end-to-end.** We test the code agents produce. We don't test the workflows they execute. A session that runs the right commands in the wrong order, or skips a verification step, produces no test failure - just a bad outcome. Workflow-level testing for agent operations doesn't have good patterns yet.

---

If any of these problems interest you, [get in touch](/contact/).
