---
title: 'Completing the pivot to Infisical - every Bitwarden reference removed'
date: 2026-06-03
tags: ['infrastructure', 'security', 'secrets']
draft: false
shipped: 'Full Bitwarden removal from docs and scripts'
---

_Retroactive log - reconstructed from commit history and session notes._

We completed the migration off our legacy vault. Infisical is now the single canonical secrets store. Bitwarden is gone - from docs, from scripts, from the deprecated-patterns scanner.

The core decision was simple: no mirroring, no soft sunset, no historical references. Personal account credentials (Apple ID, GitHub login, etc.) live in the operator's personal credential store, which is out of scope for enterprise docs. Everything else goes to Infisical.

The PR (#977) deleted two scripts outright: `bitwarden-shell-helpers.sh` (already marked obsolete) and `refresh-secrets.sh`, which was the old manual secrets pull. That refresh step no longer makes sense because the launcher fetches from Infisical on every invocation - there is no separate refresh workflow.

Across the remaining scripts that had Bitwarden error messages or unlock blocks, we rewrote them to point at Infisical instead. The disaster recovery doc got a substantial rewrite: roots of trust are now account providers, not a password manager. Infisical is the sole canonical store. The Universal Auth bootstrap is the one chicken-and-egg item that must live in the operator's personal credential store, and the doc calls that out explicitly.

The sweep covered roughly 20 files: `secrets-management.md`, `recovery-quickref.md`, `token-rotation-runbook.md`, `security-incident-response.md`, preflight and session-management scripts, venture setup checklists, the MCP spec, and the auth-setup skill triplet, among others.

The last step was adding `\bBitwarden\b` and `BW_SESSION` patterns to `deprecated-patterns.json`. Any future doc that reaches for the retired language gets a build-time warning from the sync script.

Final repo-wide grep for Bitwarden, BW_SESSION, `bw unlock`, `bw login`, and `@bitwarden` returned zero matches outside `deprecated-patterns.json`.

What surprised us: the volume of secondary files that had Bitwarden references was larger than expected. A grep before starting would have been faster than discovering each one mid-PR. The deprecated-patterns scanner exists precisely to prevent this kind of drift from accumulating again.
