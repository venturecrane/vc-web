---
title: 'Putting an Agent at the Top of the Funnel Instead of a Contact Form'
date: 2026-06-07
description: 'A prospect talks to an agent and gets a real findings report. The eval harness, adversarial personas, and voice bridge behind a generative top of funnel.'
author: 'Venture Crane'
tags: ['agent-operations', 'evals', 'voice', 'conversion']
draft: false
---

The conventional top of a B2B funnel is a form. A prospect arrives, reads some copy, and either fills in fields or leaves. The form captures intent; a human follows up later; the value of the engagement only starts after the call is booked. We are building an AI employee product, and we decided the agent should do work at the very first touch instead of waiting behind a form. A prospect arrives, has a real conversation with an assessment agent, and walks away with an evidence-bound findings report about their own operation. The conversion mechanic is not "give us your email." It is "we already started."

This is a build-log honest account. Some of what follows is wired into the live app and exercised against the real model; some is proven in an offline harness and staged behind credentials. We will be clear about which is which.

---

## The shape of the funnel

The design has a deliberate seam. The agent runs a high-caliber interview and drafts findings across a fixed set of observation domains, with every line anchored to a verbatim quote from the owner it just talked to. It shows the operation clearly: what is there, where it strains, what was never reached. Then it stops. It withholds the verdict, the prioritization, and the fix. A human owns the read, and the read happens on a closing call.

That withheld read does two jobs. It is the honest boundary between what an agent should assert and what a person should own. It is also the conversion engine: the report is good enough to prove the work is real, and incomplete in exactly the way that makes booking the call the obvious next step. The agent authoring findings from a live conversation is producing real data, not marketing copy; the thing it refuses to produce is the thing the call is for.

Two properties fall out of that design and drove most of the engineering. The interview has to be genuinely good, because a shallow conversation produces a shallow report and the report is the pitch. And the endpoint is public with every turn costing a live model call, so it has to survive the open internet before it ever sees an ad click.

---

## Proving the interview is good before shipping it

The hard part of an assessment agent is not the plumbing. It is knowing whether the interview it conducts is any good, and knowing it before a real prospect is on the other end. "It sounds fine when I try it" is not a measurement.

So the first thing we built was not the agent. It was a harness to measure one. The harness generates multi-turn assessment transcripts by putting an interviewer model in conversation with a simulated-owner model, then hands each transcript to an independent grading subagent blind to the expected verdict. The grader scores coverage of the observation domains, whether the interviewer probed the threads worth probing, and whether it fabricated anything the owner never said.

The first run was a discrimination test: same simulated owner, two interviewers, the real assessment skill and a deliberately broken null control that ignores answers and asks generic questions. The real interviewer scored 96 and graded autonomous; the null scored 12 and failed, with the grader catching it fabricating a revenue figure and a named champion the owner never mentioned. An 84-point gap. The harness could tell a good interview from a bad one, sharply, on live-generated transcripts.

That looked like a win, and it was the wrong number to celebrate. A gap over a deliberately broken control measures working-versus-broken. It is a floor that cannot fall. It does not measure caliber, because anything functional beats a strawman.

A critique pass made that the load-bearing fix. We added a competent baseline, an interviewer that asks sensible discovery questions but never adapts and never fabricates, because real-versus-competent is the bar that matters. We added three adversarial personas across distinct verticals, each carrying off-script tells that map to no canned probe, so catching them measures generalization rather than checklist memory: an evasive under-talker with a planted self-contradiction, a no-numbers owner suggestible enough to agree to any figure floated at them (the fabrication trap), and a defensive owner who bristles at probing and tries to end the call early. We pre-registered the pass thresholds and ran replicates, gating on the worst case rather than the average.

The retuned number moved and became falsifiable. The real interviewer dominated the competent baseline on probe depth and off-script catches in every replicate, where the baseline catches zero off-script tells by construction. On the no-numbers persona it asserted zero dollar figures in every run while the broken control fabricated revenue and was caught. It also failed honestly: against the defensive persona the report-grade threshold missed on two of three runs, and we reported that rather than reworking until it was green. The candid framing went in the report, not a footnote: grader, owner, and interviewer are all the same model family, so agreement is not independence; a cooperative simulated owner is an upper bound, not a prospect; the result is encouraging, not yet "caliber credible," which needs a human calibration round over a stocked set of transcripts.

The lesson is portable and we keep relearning it. When you measure a system against a strawman, you measure that it is not broken. To measure caliber you need a competent baseline and adversarial inputs, and you need to pre-commit to the pass bar so a near miss is a finding you report rather than a number you quietly retune.

One more thing fell out of the harness. Run over two captures of the same business, a strong interview (graded 95) yielded sixteen findings across all five domains and caught an off-script money leak; a weak interview (graded 58) yielded eleven safe, shallow findings and missed it. The discipline held identically on both, with zero fabrication either way. Interview caliber buys richness, not safety. A thin conversation produces a shallow report, never a dangerous one.

---

## The voice bridge that keeps the brain in our app

We wanted the prospect to be able to talk, not just type, under one constraint: the eval-proven interviewer had to stay the brain. We were not going to paste a prompt into a voice vendor's dashboard and lose the thing the harness proved.

ElevenLabs supports pointing a voice agent at a custom LLM over an OpenAI-compatible endpoint. So the voice agent calls our endpoint, and our endpoint is a translation bridge: it accepts the OpenAI chat-completions request, injects our interviewer system prompt, proxies to the Claude API, and streams the reply back translated from Anthropic's event stream into OpenAI completion chunks. No model lives in the vendor's dashboard, and the voice and typed channels share one brain feeding the same findings step.

Getting that bridge working in production took a debugging pass worth recording, because a curl to our endpoint streamed perfectly while real voice sessions died after the first spoken answer with "custom LLM generation failed." The difference was what the real agent sends versus what a hand-written test sends: chunks missing a `created` field that strict parsers require, array-shaped and multimodal message content where our parser expected a string and rejected the whole batch, and error paths that returned JSON when the caller required the error itself to be a stream. The general shape of that bug is familiar: an integration tested against a clean synthetic request meets a real client messier than the contract suggested, and the failure surfaces only in the live handshake.

---

## Making a public, generative endpoint survive the open internet

A funnel endpoint that makes a live model call on every turn is a budget-exhaustion target before it is anything else. The first version was protected by an IP rate limit alone, which sheds volume but does nothing against IP rotation: a proxy pool or botnet can open unbounded fresh assessments, each a full multi-turn conversation, and burn the model budget so a real prospect arrives to a depleted endpoint.

The fix was a signed, server-tracked session behind the IP limit. The opening turn mints an HMAC-SHA256 signed token carrying a random session id and an expiry, opaque to the client. Every continuing turn must present that token; the server verifies signature and expiry, fails closed on anything missing, malformed, tampered, or expired, then charges one turn against a per-session counter and refuses at a ceiling. Because each accepted turn is exactly one model call, a per-session turn ceiling is a per-session cost ceiling, and the signature binds that ceiling to the session rather than to an IP, which is the property that defeats rotation. The body is parsed field by field from unknown, never cast.

That hardening is the boundary between a demo and something you can point advertising traffic at. A generative top of funnel inverts the usual economics: every visitor costs real inference, so abuse resistance is not an afterthought, it is a precondition for turning the thing on.

---

## What is wired and what is staged

Wired and exercised against the real model: the typed assessment loop from a prospect's click to a rendered findings report; the custom-LLM voice bridge, with an agent bound to it and confirmed streaming our interviewer; the signed-session cost ceiling. The eval harness, the adversarial personas, the competent baseline, and the findings-draft skill all run offline and produced the numbers above.

Staged or honest about its limits: the assessment route is unlinked from public navigation and rate-limited while it is dogfooded; the findings report has a portal-native render built as a quality artifact for a render-vendor decision, but the persistence and identity plumbing behind it is a follow-on; the caliber result is encouraging but not yet validated by a human calibration round or by real prospects; and the funnel model itself ships as a decision to build with explicit reversal triggers, provisional until real prospects validate it.

The transferable lesson is the inversion. Most funnels capture intent at the top and deliver value after the human shows up. Put a competent agent at the very first touch and the order flips: the prospect gets real work immediately, the report does the qualifying, and the human is spent on the close rather than on discovery. That only works if the agent is actually good, which you cannot assert and have to measure against a competent baseline, and if the endpoint can survive being public, because a generative front door pays inference for every knock.

---

_We build an isolated per-customer AI employee product on Cloudflare Workers, D1, and the Claude API, with a voice channel bridged to ElevenLabs. This article describes work landed in June 2026; the assessment loop and voice bridge are live and dogfood-only, and the interview-caliber result is encouraging signal pending a human calibration round and real prospects._
