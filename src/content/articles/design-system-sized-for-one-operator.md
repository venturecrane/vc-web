---
title: 'A Design System Sized for One Operator and a Team of Agents'
date: 2026-04-25
description: 'Multiple ventures, one tokens package, three brownfield migrations, a CI gate, and the GA cut. What we built when the conventional playbook did not fit.'
author: 'Venture Crane'
tags: ['design-system', 'tokens', 'tailwind-v4', 'monorepo', 'agent-workflow']
draft: false
---

Running multiple ventures means multiple codebases, multiple color palettes, multiple sets of CSS conventions, and as many opportunities for agents to pick a hex value by gut. Without guardrails, every new feature becomes an ad hoc design exercise. The pattern shows up in the build logs: a button color drifted by a single shade, a surface tone went off-spec, an accent ended up declared inline three commits in a row because the agent did not know the canonical token name. Multiply across the portfolio and the products start to look like distant relatives instead of family.

The standard fix is to ship an enterprise design system. The standard playbook for that fix assumes a 50-designer organization with a federated design council, an RFC process, a dedicated systems team, a Figma library with versioned tokens, and a quarterly governance cycle. None of that fits one operator with AI agents as the workforce. So we built the smallest functional equivalent of each piece and shipped it end-to-end in a single push.

## The shape of the problem

The portfolio spans multiple codebases that mix Astro and Next.js, Tailwind v3 and Tailwind v4, light/dark and dark-only theming. Most ventures declared inline custom properties in their own `globals.css` under a venture-specific prefix (`--<venture>-accent`, `--<venture>-surface`, and so on). One venture was the exception: its tokens were declared without a prefix at all (`--color-accent`, `--color-surface`), which made it the complex migration case later. Where the prefix existed, the naming convention was aligned. The values were not.

Three concrete failure modes had already happened:

1. An agent, asked to build a new card component, looked at the surrounding code, picked a hex literal it inferred from a sibling component, and committed it. The shade was three points off from the venture's canonical surface token. No CI check caught it.
2. A migration that touched dark-mode tokens silently broke contrast on two routes because the WCAG ratio for the new value had never been recorded anywhere.
3. Different ventures rebuilt the same primitive (status pill, money display, list row) in multiple ways. Each implementation was internally consistent. Cross-venture, the family resemblance was gone.

The token system is the fix for the first two. A pattern library is the fix for the third. We needed both, sized for one operator.

## The sizing principle

Every primitive from the surveyed enterprise systems had to pass one test: does its smallest functional equivalent justify the work to build it. If yes, ship the smallest version. If no, drop the layer entirely.

This is not a defense of austerity for its own sake. It is the only frame that produces a system the workforce can actually use. The workforce here is a fleet of AI agents. They benefit from explicit triggers, machine-readable canonical files, fast CI feedback, and one source of truth per concept. They do not benefit from a federated council, a quarterly cycle, or an approvals process that gates a token change behind two days of human discussion. Every ergonomic primitive that exists for a 50-person team has to be either dropped or replaced with an automated equivalent.

The output was the following layers, condensed to the minimum that each layer required:

1. **Foundations** - existing prose. Brand architecture and overview docs we already had.
2. **Tokens** - one npm package, `@venturecrane/tokens`, published to GitHub Packages, consumed by every venture as a versioned dependency.
3. **Components** - a markdown catalog of existing components across ventures, classified by Atomic Design vocabulary. The catalog does not ship components. It surfaces duplicates.
4. **Patterns** - a markdown library of recurring problem-solution pairs in Polaris's format. Seeded from one venture's seven established rules.
5. **Templates** - empty until needed. We did not invent work to fill the layer.
6. **Guidelines** - absorbed inline into the layers above. No separate artifact.
7. **Tooling** - the `ui-drift-audit` skill, promoted from one venture to enterprise scope, extended with token-compliance and JSON output, wired into per-venture CI as a merge gate.
8. **Governance** - one prose document covering contributions and deprecation. Not a council.

Layers 5 and 6 are notable for being deliberately empty. Conventional systems ship them anyway. We did not, and the system is not poorer for it.

## What actually shipped

The whole rollout went out across a single push of streams labeled A through D, with parallel migration streams under C. The merged PR trail is dense, so here is the operational shape rather than every commit:

**Stream A (Foundation).** The `@venturecrane/tokens` package landed at `packages/tokens/` in the studio monorepo, sourced from W3C-DTCG JSON, compiled via Style Dictionary v4 to per-venture CSS files. Every active venture (plus a marketing-site variant) was pre-staged with its own token JSON. Each venture's JSON declares only what diverges from the shared base; everything else inherits. The publish workflow tags `tokens-v*` and routes pre-releases to the `rc` dist-tag and stable releases to `latest`. The adoption runbook landed as the canonical seven-step migration recipe with rollback playbook included.

**Stream B (Enforcement).** `ui-drift-audit` graduated from a single-venture skill into the enterprise catalog, with token-compliance checks added (raw hex values, un-tokenized spacing, raw Tailwind color classes), JSON output for CI integration, and a status-words config for vocabulary drift. Per-venture CI workflows now run the audit on every PR touching `src/**` or `*.css` and gate merge against a calibrated threshold.

**Stream C (Migrations).** Three brownfield ventures burned in:

- **First brownfield migration (Stream C1).** `npm install @venturecrane/tokens@0.0.2-alpha.0`, replace inline declarations with `@import '@venturecrane/tokens/<venture>.css'`, run the build, capture pre/post screenshots. 9 files touched. The grep-based smoke for unprefixed `var()` references came in at 5 on both sides (legitimate Next.js font variables, not token misses).
- **Second brownfield migration (Stream C3).** Same pattern, 15 files. Grep-based smoke at 10 on both sides (legitimate non-token references, mostly content classnames).
- **Third brownfield migration (Stream C5).** The complex case. This venture had historical CSS using unprefixed `var(--color-*)` references. Rather than wrap in a layer (the spike for that path failed cleanly), we shipped the rename in two PRs. PR A added `--<venture>-*` aliases alongside the unprefixed names, additively. PR B codemodded all 1634 unprefixed `var()` references across 76 source files to the prefixed names and converted the legacy `@theme {}` block to `@theme inline {}` with every value sourced from the package's prefixed tokens. The grep-based smoke for unprefixed references went from 1634 to 0.

**Stream D (Audit).** The `enterprise-review` skill grew a design-system compliance matrix that walks every venture and reports four binary checks per venture: package adoption, CSS import, `CLAUDE.md` wiring, and audit-workflow status. Surfaces migration drift across the portfolio without anyone having to remember to check.

**GA cut.** Once the three brownfield migrations were burning in clean, we tagged `tokens-v0.1.0` and let the publish workflow promote it to the `latest` dist-tag. Anything pinning `^0.1.0` now resolves to the GA build. The alpha-first publish strategy meant the burn-in versions sat under `rc` for the entire pilot phase; production never picked them up by accident.

## Three technical decisions worth naming

The runbook captures the mechanical work. Three architectural decisions are not in the runbook but shape every venture migration that runs through it.

**The hybrid Tailwind v4 pattern.** Each migrated venture imports the package CSS at the top of its `globals.css`, then uses Tailwind v4's `@theme inline { }` block to alias `--color-*` Tailwind variables onto the package's `--<code>-*` tokens. The result: every Tailwind utility class still works (`bg-surface`, `text-accent`, etc.) and every custom-property reference still resolves. No wholesale Tailwind config rewrite. No utility surgery. The `@theme inline` clause is a thin shim, and removing the package import would return the venture to its prior state without other side effects. This pattern lets us migrate Tailwind v4 ventures in hours instead of days.

**Alpha-first publish.** The publish workflow's dist-tag logic routes any version with a pre-release suffix (`-alpha.0`, `-rc.1`) to a non-default dist-tag, and routes clean versions to `latest`. We ran the entire burn-in under `0.0.1-alpha.0`, `0.0.2-alpha.0`, etc. Production ventures pinning `^0.1.0` were untouched until we explicitly cut GA. This is the strongest available protection against an accidental-publish blast radius. It also means we can keep iterating on `rc` after GA if a downstream venture surfaces a token-shape regression.

**Additive-then-conversion for renames.** The unprefixed-token migration was the test case. The two-PR shape (additive aliases, then codemod + conversion to `@theme inline {}`) is now the canonical answer for any venture that has historical CSS using the wrong prefix. Both PRs land green on their own. The visual diff between them is identical. Reverting either is a one-line change. This is the only migration shape that is both safe and reviewable when an automated codemod is touching dozens of files across a venture.

## What the CI gate actually does

`ui-drift-audit` lives in every migrated venture's `.github/workflows/ui-drift-audit.yml`, fires on every PR touching `src/**` or `*.css`, posts findings as a PR comment, and fails the check above the calibrated threshold.

The threshold calibration matters. Tier 1 brownfield ventures start at zero: any token violation fails the merge. Tier 3 greenfield ventures will start at a higher migration baseline and ratchet down as drift is cleaned up. The threshold is a per-venture knob, set in the migration PR description and the workflow file.

The reason the threshold is calibrated rather than uniform is that "zero violations" is the wrong target during a migration in flight. A venture mid-migration will legitimately have more violations than its post-migration state. The gate's job is to prevent regressions against the venture's own baseline, not to enforce a portfolio-wide constant.

## What is next

Several ventures remain on the migration line. Token JSON is pre-staged for all of them. The two greenfield ventures need their Tailwind v3 to v4 upgrade PRs to land first as separate PRs, both already scoped. The third is conditional on its design-spec gap closing. The runbook is the same in every case; the prerequisites differ.

The marketing-site variant has token JSON pre-staged but no migration PR yet. It is a flat marketing site, lightest of the remaining migrations, scheduled for the next push.

The system itself is now in steady-state. New tokens enter through small contributions per the governance doc: add to the venture's JSON, republish, pin the new version. Inline overrides in venture CSS are the one declared anti-pattern; they reintroduce the drift the package exists to prevent. Future patterns enter through the patterns library on a dated, not-versioned cadence. Future components enter the catalog the same way.

## The frame

A design system, sized for one operator with AI agents as the workforce, is not a smaller version of the same artifact a 50-designer org would build. It is a different artifact. The operator runs design constraints from the top, the agents implement against the constraints, the CI gate prevents drift, the package version pin makes drift visible in a `package.json` line. The federated council, the quarterly cycle, the RFC process, the Figma library with versioning - all replaced with one npm package, one CI workflow, one runbook, one audit skill.

The work that scales for an agent workforce is not building UIs by hand. It is building constraints that make every UI the agents touch consistent. The tokens package, the audit gate, the runbook, and the patterns library are all that constraint, expressed as enforcement.

The portfolio still looks like family. From here, it stays that way by default.
