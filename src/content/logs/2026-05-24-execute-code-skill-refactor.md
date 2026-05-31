---
title: 'Moving agent fetch loops into a code-execution primitive'
date: 2026-05-24
tags: ['ai-employee', 'agents', 'tokens', 'reliability']
draft: false
---

_Retroactive log - reconstructed from commit history and session notes._

We refactored a family of agent skills in the AI employee product we're building so their per-item fetch loops run inside a single code-execution block instead of one tool call per item. The skills touched: inbox triage, status-report assembly, an accounts-receivable chasing skill, a retainer-hours reconciler, and several document-preparation skills. The pattern is the same in every case. Phase one is a fetch: one block of Python iterates the items and pulls everything from each connector into a single structured JSON document. Phase two is reasoning: the agent reads that one document and does the actual judgment work, drafting, classifying, escalating.

The reason this matters is round-trips. Before the refactor, the inbox triage skill issued roughly four tool calls per message, so a 25-message run dropped about 100 separate tool-result blocks into the agent's conversation context, around 50k tokens of inbound budget. Moving the loop into one code-execution call keeps every intermediate result inside the child process and returns one consolidated document, cutting that to the 15k-to-25k range. Status-report assembly was worse: a 20-client run crossed project management, analytics, paid media, CRM, and prior reports per client, roughly 120 tool-result blocks, now a single return value. Fewer round-trips is cheaper, but the bigger win is reliability. A single connector failure becomes a parse-failed row inside the JSON payload instead of aborting the batch, and the affected section renders a placeholder marker rather than inventing content. The document-preparation skills use a parallel-subagent variant with a strict schema contract: the parent refuses to assemble if subagent return-key counts disagree, because a document with a misaligned table is worse than no draft at all.

A nice second-order effect showed up in the AR skill. Its most important safety check is cross-referencing each invoice's payment status before drafting a dunning note, so it never chases an already-paid invoice. When that check was N extra tool calls landing in context, it was tempting to skip on cost grounds. Inside the code-execution block the cross-check runs at zero conversation-context cost, so defending against the single worst AR mistake stopped being a tradeoff.

What surprised us: the cheap-looking ones were not the safe ones. While adding a suppressed-wake audit to the retainer-hours and paid-media skills, so the cron tick can decline to wake the agent and still leave a record, we hit a subtlety that nearly inverted the intent. The audit-write itself can fail, and a naive implementation would have suppressed the wake and lost the record at the same time, exactly when you most want to know. The fix was to make audit-write failure fall back to waking the agent rather than staying quiet. Suppressing work is fine; suppressing work silently is not, and the difference lived in one branch of error handling that was easy to get backwards.

What's next: token-reduction grading on the synthetic fixtures to confirm the 50 percent target.
