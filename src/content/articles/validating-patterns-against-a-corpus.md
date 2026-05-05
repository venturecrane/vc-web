---
title: 'Validating pattern-matchers against a real corpus, not your imagination'
date: 2026-05-02
description: 'Our v1 reflex hook had zero corpus recall. v2 was corpus-driven from the start. Mine real transcripts before shipping pattern-matching code.'
author: 'Venture Crane'
tags: ['agent-operations', 'engineering-practice', 'methodology']
draft: false
---

We shipped a hook. Then we tested it against real data. The patterns we had derived from a single session matched zero of eighteen real examples. The lesson is not specific to agent operations - any rule-based classifier built from a single example will overfit. But agent ops is where we learned it firsthand.

---

## The v1 design

The problem: agents drift when a Captain redirect lands lossy. "Recalibrate" and "step up" are imprecise. They bias toward "ask less" rather than "verify more," which is not the same thing. A real-time hook - firing on every prompt submission - could catch those redirects as they arrive and inject a behavioral cue before the agent continued.

We wired a `UserPromptSubmit` hook via Claude Code's settings. The hook read the incoming prompt from stdin, tested it against six regex patterns, and prepended a short reflex reminder when a pattern matched.

The six patterns:

- `recalibrate`
- `step up`
- `stop asking`
- `out of sync`
- `you keep <verb>ing`
- `questions you can answer`

They came from one session's post-mortem. The patterns were drawn from that session's language - specific phrasings the Captain had used while redirecting. We tested them against the session's own data. They fired.

That is not validation. That is overfitting.

---

## The challenge

After merge, the Captain asked two questions: did we actually research these patterns? Will we learn as new patterns emerge?

The questions sent us to the data.

---

## Corpus mining

We pulled five recent Claude Code JSONL transcripts. A JSONL transcript records every turn in a session - prompts, responses, tool calls, tool results - as newline-delimited JSON.

The numbers:

- **906 user turns** across the five transcripts
- **18 verbatim Captain redirects** - turns where the Captain explicitly told the agent it had gotten something wrong

Eighteen redirects across 906 turns is roughly a 2% signal density. Low enough that a pattern which fires on common phrasing will drown in false positives.

We ran the original six patterns against all 18 redirects. Match count: **zero**.

Zero recall. The patterns were drawn from one session's syntax, not from the actual distribution of how redirects are phrased.

---

## What the corpus actually showed

Analyzing the 18 redirects produced two findings that made the regex approach untenable.

**Finding 1: negation dominance.** Every single redirect - 100% of 18 - opened with negation. "I don't", "what", "no, please", "no -". A regex that matches on negation-opening phrases would fire on most conversational prompts, not just redirects. The false-positive rate would make the hook useless.

**Finding 2: drift family clustering.** We had 20 `feedback_*.md` memory entries - the auto-memory captures of sessions where the agent got something wrong. Those entries clustered into five stable drift families:

1. Verification Skipping (agent opines before reading)
2. Reference Blindness (agent ignores existing docs)
3. Context Misalignment (agent answers the wrong question)
4. Delivery Theater (status updates that restate known state)
5. Escalation Shortcuts (unnecessary Captain pings)

The original six patterns weakly covered one family. They missed the three largest: Verification Skipping, Reference Blindness, and Context Misalignment.

A tuned regex could increase recall. Corpus-validated patterns, derived from all 18 redirects, would probably catch around 30%. But the negation-dominance finding means any pattern with decent recall will also match ordinary non-redirect prompts. The signal:noise ratio is structurally bad.

---

## The v2 decision

The corpus findings killed the detection-based approach. We replaced the entire pattern matcher with an unconditional ~50-token primer injected on every prompt:

```
[reflex] Verify before opining; decode redirects precisely; classify questions
(factual=read, judgment=decide, Captain-only=ask); respect mode framing.
See docs/instructions/session-reflexes.md.
```

No detection. No match. Fires always.

Universal coverage is the point. By dropping detection, we also drop false positives and false negatives. The tradeoff is token cost: ~50 tokens per turn as permanent context overhead, versus v1's 0%-recall regex that cost nothing when it silently missed every redirect.

Three alternatives were on the table.

**Tune the regex.** Corpus-validated patterns achieve around 30% recall with bad signal:noise. The always-on primer is still needed as a floor. Tuning buys marginal gain at the cost of maintenance.

**LLM classifier.** High precision, but 1-3 seconds of synchronous latency per prompt. The hook blocks prompt submission while it runs. That contradicts the operating ethos.

**Hybrid.** Detection plus primer fallback. Added complexity for marginal gain. Worth revisiting only if the 30-day review shows v2 underperforming.

---

## Why it matters beyond this hook

The failure mode generalizes. Build a corpus from a single session, derive patterns from it, test against the same session - the patterns will fire. They were derived from that data. The session's syntax is not the distribution.

The Captain's language varied across the five transcripts. "Recalibrate" and "step up" were one session's vocabulary for a specific type of drift. A different session, a different problem - the language changed. Patterns that capture one session's phrasing miss everything else.

This applies beyond agent ops. Any rule-based classifier - spam filters, input validators, content moderation heuristics - needs a corpus that represents the actual distribution of the thing being detected. Five examples is a floor, not a target. One or two examples is not a corpus; it is an anecdote dressed up as signal.

---

## The learning loop

No new telemetry was built. The `feedback_*.md` memory pattern is already the corpus mechanism - when a session goes wrong and the Captain issues a correction, a memory entry captures it. Those entries are the redirects. The corpus grows automatically.

A 30-day review on 2026-05-30 will compare the new feedback entry rate against the prior 30 days. If drift incidents decline, the primer is working. If not, the next step is revisiting the primer language against whatever new memories have accumulated since v2 shipped.

---

## The rule we wrote down

Do not merge pattern-matching code until you have validated against at least five real transcripts. v1 felt correct because the patterns came from a session where they happened to fire. The corpus revealed they were session artifacts. Running the validation first would have saved the entire v1 iteration.

Five is a floor. The 18 redirects across 5 transcripts gave enough signal to expose 0% recall. Three redirects from one transcript would have confirmed the original patterns and sent us down a tuning path that was never going to work.

The corpus is already there. The `feedback_*.md` memory entries are the redirects. The transcripts are the raw data. Mining them before writing the first pattern takes less time than shipping a v1 that fails at zero recall.
