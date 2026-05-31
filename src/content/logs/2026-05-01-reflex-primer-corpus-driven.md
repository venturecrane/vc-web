---
title: 'Reflex primer v1 to v2 in one day after corpus check'
date: 2026-05-01
tags: ['agent-operations', 'engineering-practice', 'methodology']
draft: false
---

Two PRs, one day. v1 shipped in the morning with six regex patterns derived from a single session. By evening, a corpus check had killed the pattern matcher entirely and replaced it with an unconditional primer. This is the operational record.

## v1: the hook

We wired a `UserPromptSubmit` hook via the Claude Code harness. The hook reads the incoming prompt from stdin, tests it against a regex, and prepends a reflex reminder when the pattern matches.

The six patterns came from a post-mortem of one session where agent drift was visible and the Captain had redirected explicitly. The patterns fired against that session's data. We tested them, they worked, the hook shipped.

PR #778 merged that morning.

## The challenge

After merge, the Captain asked two questions: did we actually research these patterns? Will we learn as new patterns emerge?

We went to the data.

## Corpus: 5 transcripts, 906 turns, 18 redirects

The Claude Code harness writes JSONL transcripts for every session. We pulled five recent transcripts and extracted every user turn where the Captain explicitly told the agent it had gotten something wrong.

The numbers:

- **906 user turns** across 5 transcripts
- **18 verbatim Captain redirects** - a 2% signal density
- **0 of 18 matched** by the original 6 patterns - 0% recall

The patterns were drawn from one session's vocabulary. They were not a generalizable signal.

Two findings made any regex approach untenable:

**Negation dominance.** 100% of the 18 redirects opened with negation: "i don't", "what", "no, please", "no -". A pattern that matches on negation-leading phrasing would fire on most ordinary prompts. The false-positive rate would destroy the hook's usefulness.

**Drift family gap.** We had 20 `feedback_*.md` memory entries capturing sessions where the agent had gone wrong. Those entries cluster into five stable families:

1. Verification Skipping
2. Reference Blindness
3. Context Misalignment
4. Delivery Theater
5. Escalation Shortcuts

The original six patterns weakly covered one family. They missed the three largest: Verification Skipping, Reference Blindness, and Context Misalignment - the ones that generate the most friction.

Corpus-tuned regex patterns would have recovered roughly 30% recall with bad signal:noise. That ceiling, combined with the negation-dominance finding, killed the detection approach.

## v2: the primer

PR #779 replaced the pattern matcher with an unconditional injection. Every prompt, every turn:

`[reflex] Verify before opining; decode redirects precisely; classify questions (factual=read, judgment=decide, Captain-only=ask); respect mode framing.`

No detection. No patterns to maintain. ~50 tokens of permanent context cost per turn, versus v1's 0%-recall regex that cost nothing when it silently missed every redirect.

Three alternatives were evaluated and rejected:

- **Tuned regex** - 30% recall ceiling with poor signal:noise; still needs always-on primer as a floor
- **LLM classifier** - 1-3 seconds of synchronous latency per prompt; blocks the session, contradicts the operating ethos
- **Hybrid** - added complexity for marginal gain; revisit only if 30-day review shows v2 underperforming

The four reflexes in the primer map directly to `docs/instructions/session-reflexes.md`. The hook that was doing detection now unconditionally prepends this string on every prompt submission.

## What is not done

The hook lives in the harness settings file, which is not propagated by `syncClaudeAssets`. That utility syncs commands and agent configs to venture repos, not harness settings. The primer runs in the enterprise harness only. Venture-level deployments do not get it today.

Propagation - either by extending the sync utility or moving to a user-level hook - is deferred until the 30-day review confirms the mechanism is worth rolling out.

## Learning loop: 2026-05-30

No new telemetry was built. The existing `feedback_*.md` memory pattern is already the corpus mechanism. When a session goes wrong and the Captain redirects, a memory entry gets written. Those entries are the redirects. The corpus grows without any new infrastructure.

On 2026-05-30, we compare the rate of new feedback entries against the prior 30 days. If drift incidents decline, the primer is working. If not, the primer language gets revised against whatever new memories have accumulated - same corpus approach that killed v1.

The paired article covers the generalizable lesson - validate against at least five real transcripts before merging pattern-matching code. This log is the ship record: the exact corpus, the 0/18 headline, the same-day correction, and the concrete forward commitment.
