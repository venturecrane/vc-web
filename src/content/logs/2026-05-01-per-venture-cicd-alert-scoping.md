---
title: 'Per-venture scoping for CI alert briefings'
date: 2026-05-01
tags: ['agent-operations', 'multi-tenant', 'observability']
draft: false
---

An agent running a clean session in one of our ventures reported 153 unresolved CI alerts, 19 critical. That venture's repos had no criticals. We shipped PR #771 to fix the scoping. This is the ship record.

## What shipped

Four layers changed.

The notification counts endpoint gained a `group_by` query parameter. Pass `group_by=venture` and the response includes a `by_venture` map - one entry per venture code with `{critical, warning, info, total}`. The parameter is optional and the field is optional in the response. Callers that don't send it get the old behavior unchanged.

The session-start tool now branches on the current venture. Non-captain sessions pass their venture code to the counts query. The captain's session gets the fleet total plus a per-venture rollup rendered as a breakdown line. A `collapseByRun` helper was added to the session-start path: notification rows are grouped by `match_key`, with a fallback to `(repo, run_id)`. When GitHub fires a `workflow_run`, `check_suite`, and `check_run` for a single failing job, those three rows collapse to one - preferring `workflow_run` as the canonical row. That collapse was a drive-by fix triggered by the same investigation: one failing run had been rendering as three rows.

## The wrong hypothesis

The reporting agent diagnosed "no auto-resolve on supersede." The hypothesis was: when a new CI run passes, the old failure notification should resolve automatically, and that mechanism was broken.

That bug does not exist. Migration 0023 and the green-event processor implement match-key-based auto-resolve with forward-in-time ordering. When a passing run arrives for a given `match_key`, older failures for that key resolve with a full audit trail. The persistent rows reflected actually-failing runs in a different venture - runs that had not gone green because they were still failing. There was no green event to trigger resolution because the runs were live failures, just not in the reporting agent's scope.

Auto-resolve was not changed in PR #771. The fix is entirely at the read path, not the write path.

## Deploy order

Worker first, MCP on next launch.

1. Merge PR #771.
2. Deploy the context worker: `npm run deploy:prod` from the worker package.
3. The local MCP server picks up the new response shape automatically on the next session launch.

The deploy is forward-compatible by design. If an older MCP runs against the deployed worker, `by_venture` is absent from the response and the renderer skips the rollup line silently. No errors, no degraded output - just missing the rollup until MCP is refreshed.

## Verification

After deploying the worker, confirm the grouped query returns a `by_venture` map:

```
curl /notifications/counts?status=new&group_by=venture
```

Expected shape:

```json
{
  "critical": 12,
  "warning": 7,
  "info": 3,
  "total": 22,
  "by_venture": {
    "alpha": { "critical": 8, "warning": 3, "info": 1, "total": 12 },
    "beta": { "critical": 4, "warning": 4, "info": 2, "total": 10 }
  }
}
```

Venture sessions that had been showing the fleet total should show zero or their own actual count. The captain's session should show the breakdown line with per-venture sums that add to the total. Latency is worth watching for 10 minutes via worker live logs after deploy - the grouped query hits an additional aggregation path.

## What's not done

Auto-resolve was investigated but not changed. The investigation was still useful: it confirmed the resolve mechanism is correct and narrowed the fix to scoping alone. If notification staleness resurfaces, the audit trail from `processGreenEvent` is the right place to look - not this PR's code path.

The fanout collapse is keyed on `match_key` with a `(repo, run_id)` fallback. If a venture's GitHub App configuration generates events without consistent `match_key` values, collapse may be incomplete. No incidents on this yet, but it's worth checking if row counts look inflated post-deploy.
