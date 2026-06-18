---
title: 'Model Selection Is an Operational Variable, Not a Code Constant'
date: 2026-06-15
description: 'Config-driven model selection gives per-customer cost control, live tier changes without redeploy, and a verification path for actual API spend.'
author: 'Venture Crane'
tags: ['ai-agents', 'architecture', 'agent-operations', 'configuration']
draft: false
---

Hardcoding a model name into product code is the same mistake as hardcoding a database connection string. It feels fine on day one and becomes a tax on every subsequent decision.

For an AI employee product, we treat model selection as config - read from the customer's config file at runtime, not compiled into the binary. Two fields: `mainModel` and `escalationModel`. Claude Sonnet for regular work, Claude Opus for tasks that clear a complexity threshold. Different customers can sit on different tier combinations. A tier change ships in seconds without touching product code.

## Why Hardcoding Breaks

When the model name is a constant in source code, four things become harder than they should be:

**Per-customer differentiation.** Some customers run high-volume, latency-sensitive workloads where Claude Sonnet's speed-to-cost ratio wins every time. Others run lower-volume tasks where the output quality delta from Claude Opus justifies the cost premium. A constant forces you to pick one policy for everyone.

**Upgrades.** Anthropic releases a new model. To change the production default, you write code, open a PR, pass CI, and deploy. Every model upgrade is a release event. If model selection is in config, the upgrade is a config push - tested in staging, rolled out gradually, with no code diff involved.

**Escalation as a design choice.** If there is only one model configured, escalation has nowhere to go. The product can't route harder tasks to a more capable model because the routing table has one entry. The config-driven seam is what makes dual-model operation possible without branching at the code layer.

**Cost attribution.** A hardcoded constant gives you total spend but no per-decision breakdown. When model names are fields in customer config, you can tag every API call with the config version that drove it, and audit whether escalation is actually being invoked selectively or is bleeding into routine tasks.

## What the Seam Looks Like

The config file for each customer carries both model fields explicitly:

```json
{
  "mainModel": "claude-sonnet-4-6",
  "escalationModel": "claude-opus-4-5",
  "escalationTriggers": ["contract_review", "multi_document_synthesis"],
  "escalationThreshold": 0.85
}
```

At task intake, the agent reads the config and resolves which model to call before making any Claude API request. The routing logic is a pure function: task type and a confidence score from the intent classifier go in, a model name comes out. The Claude API call itself doesn't branch - it receives a resolved model name and makes the call.

The escalation trigger is not "any hard task." It is a named list of task types and a confidence threshold. Tasks that don't clear the threshold route to the main model regardless of apparent complexity. This is intentional: the cost of over-escalating is real, and the trigger list must be narrow to be meaningful.

Routing pseudocode looks roughly like this:

```typescript
function resolveModel(task: Task, config: CustomerConfig): string {
  const isEscalationTask = config.escalationTriggers.includes(task.type)
  const meetsThreshold = task.confidenceScore >= config.escalationThreshold
  return isEscalationTask && meetsThreshold ? config.escalationModel : config.mainModel
}
```

No conditional imports, no environment-variable switches, no feature flags in the inference path. The model name is data that flows through, not logic that branches.

## Cost Discipline on Escalation

Claude Opus is priced at a meaningful multiple over Claude Sonnet. That gap is the point - the price difference encodes the capability difference. But the gap only serves you if escalation is selective.

We track escalation rate per customer per week. If a customer's escalation rate climbs above 20%, that's a signal that the trigger list or threshold is misconfigured - tasks are escalating that shouldn't be. The corrective action is a config change, not a code change.

The rule we use: escalation models are for irreversible or high-stakes outputs. Contract review, multi-document synthesis, structured extraction from ambiguous sources. Drafting a routine update email is not an escalation task, even if the intent classifier returns moderate uncertainty. The trigger list is the governor.

## Verifying the Seam Works

After wiring the routing, we ran a live cost attribution test on the first internal deployment before bringing in the pilot customer.

The test is straightforward. Submit a batch of tasks split between known escalation types and known non-escalation types. Pull the raw API response headers - the Claude API returns the model that was actually called in response metadata. Compare the resolved model from the routing function against the model reported in the response. If they match on every call, the seam is clean.

We also check Anthropic's usage dashboard for the corresponding time window. The token counts segmented by model should reflect the expected ratio: if 15% of tasks were escalation-eligible and all of them cleared the threshold, roughly 15% of tokens should appear on the Opus line. A mismatch between the routing log and the usage dashboard means the resolution path is broken somewhere - likely a model name string mismatch between the config field and the API parameter.

The verification step is not optional. Routing code that compiles and passes tests but silently calls the wrong model is worse than broken code - it costs money before anyone notices.

## The Broader Principle

Model selection belongs in config alongside connector lists, enabled skill sets, and action ceilings. These are all operational parameters - they describe what the agent is allowed to do and at what cost, for this customer, at this point in their contract lifecycle.

Configuration-driven architecture is not about flexibility for its own sake. It's about separating concerns that change on different timescales. Product code changes slowly - new task types, new workflow states, new integration surfaces. Operational parameters change fast - customer tier adjustments, model upgrades, cost responses to usage spikes. When these live in the same artifact, every fast-changing decision carries the cost of a slow-changing deployment.

The model name is not part of what the agent does. It's part of how the agent is operated. That distinction determines where the name should live.
