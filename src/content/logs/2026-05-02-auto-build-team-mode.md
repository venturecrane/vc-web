---
title: 'Plan-declared workstreams ship in /auto-build'
date: 2026-05-02
tags: ['agent-operations', 'methodology', 'parallel-execution']
draft: false
---

Our plan-and-execute skill now supports team-mode execution. The team decision lives inside the approved plan - same single gate, no new approval step. This is the operational record of what shipped.

## What changed

The plan template produced by `/auto-build` now requires a fenced YAML `## Execution Mode` block. Every plan includes it. For solo work the block is two lines. For parallel work it lists workstreams with their scopes, dependency ordering, and isolation mode.

A real-shape block for a paired harness mirror update looks like this:

```yaml
## Execution Mode

mode: team
workstreams:
  - id: claude-harness
    subagent_type: general-purpose
    scope: .claude/commands/auto-build.md
    blocked_by: []
    blocks: []
    isolation: in-process
  - id: gemini-harness
    subagent_type: general-purpose
    scope: .gemini/commands/auto-build.toml
    blocked_by: []
    blocks: []
    isolation: in-process
pr_strategy: bundled
```

Required fields per workstream: `subagent_type`, `scope`, `blocked_by`, `blocks`, `isolation`. Top-level required: `mode`, `pr_strategy`. Critics see the block during Step 4 and can downgrade `team` to `solo` or upgrade the reverse. The YAML reflects the post-critique state at `ExitPlanMode`.

## Step 6.0 - what halts

Step 6 now splits before execution. Step 6.0 parses and validates the block verbatim. Four conditions halt the run entirely - no partial spawns, no best-effort recovery:

1. Parse failure - malformed YAML in the fenced block
2. Missing required fields - any of the fields above absent from any workstream or the top-level block
3. Unresolved dependency references - a `blocked_by` or `blocks` value that doesn't match any declared workstream `id`
4. `len(workstreams) > 4` - the per-wave cap exceeded

All four produce an error and stop. The decision to never partial-spawn is deliberate: in a shared filesystem, an incomplete team spawn produces branches and files in inconsistent states that cost more to untangle than the wall-clock time saved.

## The worktree isolation probe

When a workstream declares `isolation: worktree`, the executor doesn't immediately dispatch task content. It runs a probe first - `pwd && git rev-parse --show-toplevel` via `SendMessage` - and verifies the reported paths are distinct from the parent session's working tree before proceeding.

The probe is defensive. An agent that reports it's in a worktree but is actually sharing the parent working directory will produce file conflicts mid-task. The probe catches that before any real work starts.

Default isolation is `in-process`. Worktree isolation requires explicit declaration in the YAML and triggers the probe automatically.

## `/sprint` is a different skill

Adding team-mode support to our plan-and-execute skill means two skills now coordinate multiple agents. They are not interchangeable.

`/sprint` dispatches a pre-cut set of GitHub issues to fleet workers via worktree-based `sprint-worker` agents. The inputs are existing issues with assigned scopes. `/sprint` is a backlog-execution skill.

Plan-internal parallelism is for work that fits inside a single approved plan - typically a small, pre-declared set of workstreams, typically resulting in one PR (or one per workstream if `pr_strategy: one-per-workstream`). The inputs are workstreams declared inside the plan itself, not pre-existing GitHub issues.

Anti-pattern #7 in the updated skill documentation makes this explicit. The failure mode it prevents: reaching for team-mode in `/auto-build` when the work is actually a multi-issue backlog sprint, and vice versa.

## What is not done

The per-wave cap is 4 workstreams. For larger N, the pattern is sequenced waves: declare later workstreams with `blocked_by` references to earlier ones, so the executor spawns the first wave, waits for completion, then spawns the second. This works and the YAML supports it, but it requires the plan author to declare the dependency graph explicitly.

For large N where the work is GitHub-issue-shaped, `/sprint` is the right tool.

There is no automatic wave sequencing - the executor does not infer wave boundaries from file-scope analysis. The plan declares the graph; the executor respects it.

## Mirror discipline

The same change was applied to `.gemini/commands/auto-build.toml`. When a skill ships, both harnesses get the update in the same PR. The Claude Code harness and the Gemini harness run the same skill definitions by design - a skill that exists in one but not the other is a maintenance inconsistency waiting to become a behavior inconsistency.

Paired harness mirror updates are one of the canonical use cases for team-mode execution in `/auto-build`. This PR used the solo path, since the two edits were sequential by design (Claude harness written first, Gemini harness adapted from it). The skill now supports doing that work in parallel when the workstreams are genuinely independent.
