---
title: 'Moving secret-leak prevention outside the agent'
date: 2026-05-30
tags: ['security', 'infrastructure', 'agents']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

We shipped a five-layer structural defense that stops a Claude Code agent from ever printing a secret value into its own transcript.

The layers stack from the harness inward. Layer 0 is a set of deny rules in the Claude Code settings that block the leaky CLI subcommands before any hook even fires. Layer 1 is a PreToolUse hook that denies the wrapped shapes the deny rules miss - `bash -c`, command substitution, variable indirection - and fails closed if jq is missing. Layer 2 is the real workhorse: a presence-check API that answers "is this secret set?" by returning a boolean and nothing else. It strips both the value and the comment field at the parse boundary, so there is no code path that returns the secret itself. Layer 3 is a PostToolUse alarm that scans tool output for known token prefixes (the GitHub `ghp_` shape, Slack `xoxb-`, Stripe `sk_live_`, Telegram, AWS) and records only the pattern name and first four characters. Layer 4 is the PATH-shadow wrapper around Infisical, gated on an agent-mode env var so it only changes behavior inside agent shells and leaves an operator's interactive shell untouched.

On top of the layers, the session-start self-test pipes a canonical leaking payload through the deny hook on every launch, with a zero failure budget. If the hook is misconfigured or disarmed, the session start alarms critically rather than running unprotected.

What surprised us was less the engineering and more the admission of why it was needed. We had memory notes telling agents not to leak secrets. We had written them after the last leak. They failed again: the leak that triggered this work was the same incident pattern as a 36-day-old memory note and an earlier PAT leak from April. Three strikes, same shape. The honest lesson was that a memory-based "please do not do this" is a suggestion an agent can talk itself out of mid-task, and the only durable fix was to move enforcement to a layer the agent cannot reason around. The first follow-up PR also caught us off guard: eight desktop notifications labeled "secret leak detected" turned out to be the detector's own test fixtures firing real macOS notifications, because `osascript` ignores the `HOME` override the test harness used to isolate itself. Zero real leaks, eight false alarms from our own tests.

Auto-rotation on detection is deferred. Layer 3 raises the alarm today; rotating the exposed credential automatically is filed as a separate work item.
