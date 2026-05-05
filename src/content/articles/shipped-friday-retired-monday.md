---
title: 'Shipped Friday, retired Monday: kill-discipline in four days'
date: 2026-05-05
description: 'A Phase 1 feature shipped end-to-end Friday. Monday a P0 client-portal bug closed it. Four days from launch to clean removal.'
author: 'Venture Crane'
tags: ['agent-operations', 'kill-discipline', 'shipping']
draft: false
---

We published a piece on kill-discipline as a practice - when to stop, how to escalate, why agents that know when to quit are more valuable than agents that don't. This is the concrete instance: a Phase 1 feature that shipped on a Friday and was retired four days later. The arc was clean. That is the part worth examining.

## What shipped Friday

Four PRs merged in a single Claude Code session. A doctrine note capturing the architectural decision. A worker pipeline that drove the feature's analysis step. A durable workflow migration that wrapped that analysis in retry-and-resume. And a prospect-facing portal handoff with a magic-link email. The feature flag flipped live by May 1.

That is an end-to-end Phase 1 surface, shipped from a single approved plan in one session.

## The bug

Over the weekend, the feature accumulated a P0 bug. A returning prospect followed an orphaned browser tab from a prior context and landed on a black "Not Found" page. The feature had assumed every visitor arrived with an active session context. That assumption held for new visitors. It didn't hold for returning visitors with stale tabs. The Captain saw the broken state on a Monday morning client visit - not from monitoring, from looking at the screen.

The design assumption was wrong. The surface area was small enough to read immediately. The decision took about a minute.

## What shipped Monday

Two PRs. The user-visible surface came down: the tab, the route, the navigation entry. Gone.

The underlying data stayed. The audit trail stayed. The records that downstream tooling relied on stayed. Retirement was surgical because the architecture made it surgical - the surface and the data were separate things from the start.

Total elapsed: four days from feature flip to clean removal.

## Why four days was possible

Three things made the arc short.

**The feature shipped from a single approved plan.** The surface area was bounded before the first PR opened. Everything the feature touched was named in the plan. There was no discovery phase on Monday to find loose ends - they were already catalogued. The retirement PRs knew exactly what to remove because the build PRs had named exactly what they added.

**Data and surface were separable.** A feature retirement that also destroys data is not a retirement, it is a rollback - and rollbacks are expensive and risky. Because the analysis records and audit trail were stored independently of the user-visible surface, removing the surface didn't touch the data. That choice was made during the architectural decision phase, not during the crisis. Retirement was surgical because the design made it surgical.

**No political cost for killing it.** The Claude Code sessions that built the feature the previous week were the Claude Code sessions that retired it Monday morning. No team was defending their work. No manager was protecting a project. No process required a committee to agree that the feature should die. The Captain called it; the agents executed.

The asymmetry most teams live with runs the other direction: features cost more to ship than to retire, so they ship reluctantly and stay forever, even after the assumption that justified them is proven wrong. We are trying to make those costs symmetric. The same plan-and-execute workflow that ships a feature in a session should be able to retire it in a session. That requires the architecture to support it - separable data and surface, bounded scope - and it requires the team structure to support it, where there is no political cost for a clean kill.

## The lesson in the bug

The P0 bug was a design assumption that didn't hold under a real usage pattern. The Captain caught it from a live client visit, not from an alert. That is a fair criticism of the monitoring posture - the assumption should have been caught by an end-to-end test that modeled returning visitors with stale tabs, not by a client visit.

The four-day window is not the lesson. The lesson is what made the four-day window possible: a bounded plan, separable architecture, and a team structure where retirement carries no political weight. Those three things apply to any feature at any stage. The four days just made them visible.

The next time we ship a feature behind a flag and a known assumption, we will trust the window again. When the assumption breaks, the retirement will be just as fast.
