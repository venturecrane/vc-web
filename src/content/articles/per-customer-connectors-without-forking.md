---
title: 'Extending an Agent Platform Per-Customer Without Forking the Core'
date: 2026-06-19
description: 'A new customer integration should be an added connector, not a change to the shared core: self-contained MCP servers, one isolated venv each, bound per seat.'
author: 'Venture Crane'
tags: ['architecture', 'mcp', 'agents', 'integrations']
draft: true
---

Every multi-tenant agent platform hits the same wall. A new customer runs a system the platform has never integrated with, and there is no vendor-supplied connector for it. The naive answer is to write the integration into the shared runtime that every customer's agent boots from. Do that twice and the shared core is now carrying code that one customer needs and ninety-nine do not. Do it at scale and adding an integration for a single new client becomes a change to the artifact every client runs, which is exactly the coupling a multi-tenant platform exists to avoid.

We hit this building a customer-installed AI agent product. The agent reads and writes against each customer's own systems through connectors. Most connectors are vendor-supplied or vetted-community MCP servers, which are pure configuration: bind them in a per-customer config file and the platform launches them as child processes with that customer's credentials. The problem is the long tail of systems with no acceptable MCP server. For those, someone has to write the connector. The question this article answers is where that code should live and how it should reach only the machines that need it.

## The shape the obvious answer misses

The platform's connector strategy already had three backend types, distinguished by a prefix in the customer config. One was an external MCP server, pure config, no in-house code. One was a Python adapter the agent shelled out to. One was an in-process substrate for demo data. The trap was that the second type, the one we wrote ourselves, did not surface tools to the agent. It was a command-line adapter reached through a code-execution tool. So a system whose capabilities the agent needs to call as first-class tools (read a matter, write a memo) could not be that kind of adapter. It had to be an MCP server, because only MCP servers materialize their tools into the agent's tool surface.

That left a fourth, previously unnamed shape: code we author, like the adapter, that surfaces tools, like the external MCP. The decision order said "when no acceptable MCP exists, build one," but it quietly equated "build" with the non-tool-surfacing adapter. The real answer for a tool-surfacing capability with no vendor MCP is to write the MCP server yourself.

Once that is settled, the only remaining question is physical: that server's code has to live somewhere on the machine that runs it, and the shared runtime image is deployed to every machine. Fold author-built servers into that image as ordinary first-class code and you are back to the bloat problem. At ninety-five author-built connectors, every customer's base image carries ninety-five server packages, ninety-four of them dormant.

## Connectors as self-contained units

The resolution is to treat each author-built connector as a standalone unit with its own dependency closure, not as a module of the shared core.

Each connector is a Python stdio MCP server in its own directory, with its own package manifest and its own console-script entry point. At image-build time, a loop walks the connector directory and installs each one into its own isolated virtual environment, using a fast resolver to build the venv per connector. Connectors never share a dependency closure with each other or with the host runtime. A connector that needs an old HTTP library and one that needs a new one coexist because neither can see the other's environment.

The build loop is deliberately mechanical:

```dockerfile
RUN set -eu; \
    for cdir in /app/connectors/*/; do \
      name=$(basename "$cdir"); \
      [ "$name" = "_sdk" ] && continue; \
      [ -f "${cdir}pyproject.toml" ] || continue; \
      venv="/opt/connectors/${name}/.venv"; \
      uv venv "$venv"; \
      uv pip install --python "$venv/bin/python" --no-cache /app/connectors/_sdk "$cdir"; \
      ls "$venv"/bin/*-mcp >/dev/null 2>&1 || { echo "FATAL: connector ${name} produced no *-mcp console-script"; exit 1; }; \
    done
```

Two things in that loop matter beyond isolation. First, the shared SDK (the directory the loop skips) is installed into every connector's venv, so every connector is built on the same base contract: a server wrapper that guarantees well-formed tool schemas, a manifest format, and a conformance harness. Adding the Nth connector is filling in a contract, not wiring bespoke plumbing. Second, the loop fails the build loudly if a connector does not produce its expected entry point. A missing console-script becomes a build error, not a runtime spawn failure on a live customer machine weeks later.

The platform launches each connector by the absolute path to its venv entry point. No PATH manipulation, no reliance on a shell environment, no ambiguity about which Python runs. The registry that the runtime reads to start connectors holds that absolute path and the connector's authentication model.

## Baked in, but inert until bound

The connectors are baked into the shared image, but baking is not running. A connector is inert until a customer's config binds it. A machine whose customer never asked for a given system has that connector's code on disk and nothing else: no process, no tools surfaced to the agent, no credentials staged. This is the same posture as a skill sitting in a catalog that no persona enables. The cost of carrying an unused connector is disk, never a running process and never an attack surface.

Activation is per-customer and conditional. The provisioning step stages a connector's secrets onto a machine only when it finds that binding in that customer's config. Credentials are per-customer by construction; the connector code follows the binding. The result is that a connector is present and live on a machine for exactly one reason: that seat asked for it. From the fleet's perspective, an author-built connector behaves identically to an external vendor MCP. Bindings and credentials are per-customer, and the code follows the binding.

This is what makes adding an integration a local change. The shared image stays substrate: the agent harness, the bootstrap, the governance surface, and the materializer that turns a binding into a launched process. It does not accumulate a catalog of per-client integration code in a way that forces a fleet-wide rebuild to serve one new client. The first real connector built this way targets a practice-management system with no first-party MCP, deployed to a staging seat. Its tool surface is the system's read operations plus exactly one write: create a memo. The fund-movement operations the underlying system exposes are never implemented in the connector and are blocked at the registry. Authority lives in a hand-maintained map the agent runtime enforces, and the connector's own manifest is checked against that map rather than trusted as the source of truth. A tool the map does not classify is refused at registration. The connector cannot widen its own authority.

## Where this applies, and where it does not

This pattern earns its complexity when three conditions hold: the platform is multi-tenant, integrations arrive one customer at a time, and the integration must surface tools the agent calls directly rather than data it reads passively. If integrations are universal (every tenant uses the same handful), the isolation buys little and a shared dependency set is simpler. If a vendor already publishes an acceptable MCP server, write nothing; bind their server as configuration. The author-built path is the fallback for the long tail, not the default.

The cost is real. One venv per connector multiplies image size and build time linearly with connector count, and the per-connector manifest plus conformance test plus authority-map entry is genuine ceremony for each integration. That ceremony is the point when the connector can take actions in a customer's system of record, but it is overhead you should not pay for a connector that only ever reads.

## The durable takeaway

The decision that compounds is refusing to let a per-customer integration become a change to the shared core. Make each integration a self-contained unit with its own isolated dependency environment, baked into the image but inert until a customer binds it, launched by the platform by absolute path, and governed by an authority map the unit cannot edit. Adding the next integration then touches one machine, not the fleet, and the shared runtime stays small and slow-moving no matter how long the tail of customer systems grows. The architecture question is never "how do we add this integration." It is "how do we add integrations such that the hundredth one is as cheap and as isolated as the first."
