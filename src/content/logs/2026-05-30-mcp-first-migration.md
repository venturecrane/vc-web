---
title: 'Going vendor-direct MCP first and retiring an aggregator default'
date: 2026-05-30
tags: ['ai-employee', 'mcp', 'integrations', 'architecture']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

We changed how the AI employee product we're building connects to external systems. The decision, recorded as an ADR, set a numbered order of preference: vendor-direct MCP server first, then a vetted community MCP server, then build the connector ourselves, and only as a long-tail fallback reach for Composio, the integration aggregator we had been defaulting to. The practical effect: connect to each system through its own MCP server wherever one exists, rather than routing everything through one aggregator.

The shift was possible because the vendor landscape moved under us. In the 30 to 60 days before we revisited the connector table, a wave of first-party MCP servers went generally available: Google Workspace, HubSpot, Salesforce, Stripe, Xero, Slack. So we migrated eight connector rows that had been pointed at the aggregator over to vendor-direct MCP endpoints, recording each one's auth model and availability status against the vendor's own published source rather than trusting memory. A few rows kept honest caveats where we could not fully verify the endpoint, and one stayed a build-it-ourselves connector because the vendor has not shipped a first-party MCP server for it yet. With the table reworked, no currently planned binding used the aggregator at all, so we removed its prompt from the customer provisioning script. That prompt had been asking the operator for an aggregator API key on every single new customer, a dead step surfaced during a standup audit.

We were deliberate about not ripping the aggregator out entirely. The schema validator and the runtime guard still accept its backend prefix, because the whole point of the new order is that the aggregator is the long-tail fallback for vendors that never ship an MCP server. We retired the default path and the provisioning ceremony, not the capability.

What surprised us: deleting old code is where you find the security gap, not where you close it. When we retired the in-tree adapter modules that the aggregator path used to depend on, a semantic diff against the replacement guard in the runtime overlay showed they were not equivalent. The new overlay guard is architecturally stronger; it adds a post-call hook that inspects each tool result, which is the right shape for the new connector doctrine. But it dropped one thing the old in-tree code did: emitting an audit event when it detects a cross-customer isolation breach. So a cross-customer leakage attempt that the overlay correctly refuses now raises silently in the customer's audit log, a real defense-in-depth gap. The old code was about to become unreachable dead code, so keeping it was not the answer; the honest move was to flag the missing audit emission as a tracked follow-up against the overlay rather than pretend the migration was clean. A stronger guard that is quieter about violations is a tradeoff worth naming out loud.

What's next: close the audit-emission gap in the overlay guard so refused isolation breaches are recorded again.
