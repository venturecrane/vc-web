---
title: 'Bake Every Author-Built Connector In, Keep It Inert Until Bound'
date: 2026-07-01
description: 'When a vendor has no MCP server you author your own. The real decision is where that connector code lives: baked into one shared image, inert until bound.'
author: 'Venture Crane'
tags: ['architecture', 'mcp', 'agents', 'ai-employee']
draft: true
---

We build an AI employee: an autonomous agent that does the connective front-desk work of a small business, and to do that job it has to bind to whatever systems of record its industry runs on. Most of those systems now expose a Model Context Protocol server, first-party or from a vetted community. You bind it as config, the agent's tools light up, and no code of yours ships to make that happen. Then you hit a vendor with no MCP server at all. The capability is real, the agent has to call it, and nobody has written the wrapper, so you write it yourself. That surfaces a question the connector strategy did not answer: where does the connector code you author physically live, and how does it reach only the machines that need it?

The naive answer feels obvious and is wrong.

## A connector that surfaces tools has to be an MCP server

The first fork is not about location, it is about shape, and it is easy to get wrong because the runtime has two ways to run code you author. One is a plain command-line adapter, reached through a generic execute-code path: the agent shells out to it, passes arguments, reads output. The other is a stdio MCP server the agent speaks the protocol to.

The distinction that matters: a command-line adapter does not surface tools. There is no bridge that turns its commands into callable tools the agent sees in its own tool list. It is a script the agent can run, not a capability the agent knows it has. An MCP server is the opposite: its whole job is to advertise tools over the protocol, so binding one makes those tools materialize into the agent's surface. The choice is forced by the capability. If the agent needs to read matters out of a practice-management system and write memos back against them as first-class tool calls, it has to be an MCP server. "When no acceptable MCP exists, build one" is the right rule, but "build one" has to mean build an MCP server, not a CLI, whenever the capability must surface tools. Naming that shape is the precondition for the location decision, because only a server has code that has to be installed somewhere and launched.

## The distribution problem that does not exist

The tempting answer to "where does it live" is to treat each author-built connector as its own shippable unit: a repository, a version pin, a release pipeline, installed onto a customer's machine only when that customer's config binds it. The code follows the binding, a machine carries a connector for exactly one reason, and the shared base image never bloats. The reasoning is fear of bloat: at ninety-five author-built connectors, a shared image carrying all of them makes every customer's base artifact haul ninety-four it never launches.

It solves a problem nobody has, and two facts already true in the system show why. The first is a precedent sitting right next to the connectors: the entire skill catalog is baked into every image, and per-customer selection is pure config. No skill ships per-customer; the binding selects from what is already present. A customer whose persona enables three skills still carries the whole catalog on disk, and that has never been a problem, because dormant skills cost only the disk they sit on. The second is the activation rail. The materializer that turns bindings into runtime config launches an MCP server only when a config binding names it, so a baked-but-unbound server is not a running process. It is inert code on disk, never launched, holding no credentials, surfacing no tools.

The per-customer-install model is therefore solving a distribution problem the inert-baked model already avoids for free, and it reintroduces the coupling the config model exists to prevent: if adding a connector for one customer means publishing and installing a unit, the connector's lifecycle becomes a per-machine operation you have to track. The skill catalog proved you do not need that. Selection is the binding, not the install.

## Baked in, kept inert, activated on bind

The corrected model is the one the skill catalog was already using. An author-built connector lives in the shared codebase as a stdio MCP server, built on a shared connector SDK, installed into its own isolated Python venv inside the one shared image. The image stays the single governed deploy unit. Every machine in the fleet carries every author-built connector, and carries almost all of them dormant.

Dormant is the load-bearing word. A connector does nothing until a per-customer config binds it. On bind, the materializer launches that connector's server by its venv console-script path, its tools surface into that customer's agent, and that customer's credentials are injected. Present-but-inert on every machine, live on exactly the machines that asked for it. The posture is identical to a catalog skill no persona has enabled: shipped everywhere, active nowhere it was not selected.

Adding a connector becomes an image change, like adding a skill: you add the server to the shared codebase, it rides the next reprovision, and it sits dormant until some customer's config activates it. No publish-and-pin step, no per-machine install to track, no separate release pipeline. The only cost is disk for inert code, paid once - the same bill the skill catalog has been paying without anyone noticing.

## Governance stays hand-authored, the manifest is only an oracle

Baking a connector into the shared image raises the obvious worry: does folding third-party tool surfaces into the governed artifact let a connector smuggle in authority? It does not, because trust is not something a connector can assert about itself.

Every tool a connector surfaces gets an action class - what the agent is allowed to do with it - and those classes are hand-authored literal lines in the governance map, reviewed in the pull request that adds the connector. The connector ships a manifest that also declares its tools' intended classes, but that manifest is never a runtime input. It is a conformance oracle: a check run against the hand-authored map to catch drift between what the connector thinks its tools do and what the map actually grants. The map is authority; the manifest is a test fixture. A connector cannot self-certify by editing its own manifest, because the runtime never reads the manifest for permissions.

The fail-closed default is what makes this safe rather than merely tidy. A tool no hand-authored line has classified does not default to allowed or to some inferred class; it fails closed to refused. Adding a connector to the image adds inert code and a set of tools denied by default until a human writes the literal lines that grant them, in a diff another human reviews. The trust surface is the reviewed map, not the shipped artifact.

## Isolation runs end to end

The last property is why none of this becomes a shared service. An author-built connector runs inside the customer's own isolated machine, launched as a stdio subprocess of that customer's agent, scoped to that customer's credentials. It is never a hosted connector service that every customer's agent calls.

That distinction is the whole point of per-customer isolation. The firm's API token and the data flowing through the connector stay on the firm's own machine and never touch anyone else's. A single shared connector service, however convenient, would re-pool exactly the isolated data the per-customer model works to keep separate, and make one connector process a blast surface across every customer at once. Baked-and-inert does not weaken that: the connector code is shared on disk, but the running process, its credentials, and its data are not. Same image everywhere, isolated execution everywhere.

## The transferable lesson

When you productize an agent that must integrate with many third-party systems, the vendors without an MCP server force you to author your own, and the instinct is to treat each author-built connector as a shippable unit installed per customer. Resist it. That answer solves a distribution problem the inert-baked model already avoids: bake every author-built connector into the one shared, governed image, and keep it dormant until a per-customer binding activates it. Dormant code costs only disk. What you buy is a single deploy unit where adding a connector is an image change like adding a skill, not a per-machine install and not a coupling that makes one customer's new connector a change to the artifact every customer runs. Then hold the other two decisions separate from location: keep governance authority in a hand-authored map reviewed in the diff with the connector's manifest as a conformance check and never a runtime input, fail unclassified tools closed to refused, and run every connector inside the customer's isolated machine scoped to that customer's credentials. The mistake is letting where the code lives drag governance and isolation toward a shared service or a self-certifying artifact.

The deferred option, if it is ever needed, is per-customer images carrying only the connectors a customer binds. That trade pays off only if baked connector count or image size ever makes the shared image too heavy to ship, and it costs the single-image trust surface to buy. Until weight actually demands it, one shared image with dormant connectors is lighter to reason about than a fleet of bespoke ones.

---

_We build a productized AI employee as isolated per-customer agent deployments, with third-party integrations bound through a per-customer config layer over a shared, pinned image. This describes an architecture decision landed in June 2026, corrected during implementation from a per-customer-installed model to baked-and-inert, with the first connector we had to author ourselves - a practice-management system with no first-party MCP - as its first instance._
