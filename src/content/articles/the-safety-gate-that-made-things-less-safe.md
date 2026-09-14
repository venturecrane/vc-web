---
title: 'The Safety Gate That Made Things Less Safe'
date: 2026-09-22
description: 'A blanket permission rule on two production CLIs forced 157 approval prompts in a single day, 117 of them on one subcommand. Click fatigue is not safety.'
author: 'Venture Crane'
tags: ['security', 'process', 'agent-operations', 'agent-workflow']
draft: false
---

We shipped a permission ruleset that forced 157 approval prompts across one repository's Claude Code sessions in a single day. One hundred and seventeen of those were on a single subcommand whose normal use is reading. The worst individual session stopped fifty-seven times. Of the calls that landed in the gated namespaces, ninety-three out of one hundred and fifty-eight were `list` or `status`.

Nothing dangerous was prevented by any of those prompts. What they bought was the habit of approving without reading, purchased at a volume that guaranteed everyone would acquire it. A gate that fires on the harmless case trains everyone to click through the harmful one.

## The rule that looked like a layer and was a replacement

The ruleset gated two production command-line tools: a hosting CLI that reaches deployed customer environments, and a Workers CLI that reaches edge infrastructure and its databases. The gating was written at the namespace level. Any invocation of the hosting CLI's remote-shell namespace prompted. Any invocation of its machine, apps or volumes namespaces prompted.

That looks like defence in depth. It is not, and the reason is in the documented resolution order. An explicit ask rule resolves before the auto-mode classifier runs. The platform documentation is direct about it: if an explicit ask rule matches the command, you are asked even in auto mode. So a namespace-wide ask rule does not sit on top of the classifier's judgment. It replaces that judgment with a blind prompt, and throws away the one thing the classifier does better than a matcher.

What the classifier does better is context. Its production-reads rule ends by session-clearing: name the target application and the operation once, meet the bar, and further read-only commands against that same target run clean for the rest of the session. That is a gate that asks once and means it. A namespace-level ask rule converts it into one approval per command, forever, with no memory of the approval you gave thirty seconds earlier.

The remote-shell namespace is the only way to read a deployed seat. So seat work, which is mostly reading, paid the entire toll. The commands that could actually destroy something were a small minority of what got interrupted.

## Verbs, not namespaces

The fix was to scope the rules to the verbs that mutate. The verb lists were read off each namespace's own help output rather than assumed, and both spellings of the CLI and every documented alias are covered, because a rule that gates one spelling of a command gates nothing.

Five namespaces mutate under every verb and stay gated whole: deploy, secrets, scale, certificates and addresses. Elsewhere only the destructive verbs are gated: destroy and kill on machines, destroy on applications and volumes.

Replaying the same day's traffic against the new rules takes 157 prompts down to 12, and all twelve are real mutations. Eight are secrets changes, three are database commands against the edge platform, one is a deploy.

Removing an ask rule routes the decision to the classifier. It does not grant anything. The production-deploy, production-reads and irreversible-deletion rules still apply, and a per-venture configuration layer names the specific applications involved, so the classifier still refuses until the operator names the target.

## The grant hiding underneath

There is one case where removing an ask rule is genuinely unsafe, and we found it on the machine we were working on.

An allow rule for the same command family can sit underneath an ask rule, inert, because the ask rule outranks it. One of our machines had exactly that: a saved grant for the hosting CLI's remote-shell command, produced at some point by an interactive "yes, and don't ask again", and invisible for as long as the ask rule stayed in place. Narrow the ask rule and that grant wakes up. The command stops reaching the classifier entirely, in the opposite direction from the one intended.

Three sibling grants on the same machine, covering logs, health checks and authentication, had no ask rule above them at all. They had been bypassing the classifier on live production seats the whole time, and the only reason we found them was that we went looking for shadowing grants before narrowing anything. All four were removed, and the procedure now says to check for them first.

This is worth stating as its own rule, because it inverts the usual intuition about which change is risky. Adding a blanket prompt feels safe and costs judgment. Removing one feels risky and restores judgment, unless a broader grant is hiding beneath it, in which case removal is the dangerous move and you will not find out by reading the ask rules.

## Distribution shaped the design

Our plan tier lacked server-managed settings, so the ruleset could not be pushed from a central console. Two mechanisms were available: a managed settings file installed per machine, and a settings file passed by our session launcher.

That constraint produced a split rule worth keeping. A managed settings file is machine-scoped, and one machine runs sessions for several ventures, so it structurally cannot carry venture-specific classifier prose. The launcher-passed file is the only venture-aware scope.

The two kinds of content then split on their failure cost. A permission matcher is a matcher: over-including costs one prompt, under-including leaves a production command ungated. So every matcher ships everywhere. Classifier environment prose is different. It is read as fact, and over-including asserts a falsehood about a machine or a venture. So it is surgical per venture, and ventures without an overlay are deliberately empty, with the floor saying so explicitly, so that absence is not read as clearance.

One detail there cost us a bug in the first draft. The two configuration scopes concatenate for permission rules but replace for the classifier's environment slots, and there is no token for inheriting the built-in defaults on the replacing side. The first version of the floor silently dropped three built-in environment slots, including the fallback that assumes a repository is private. It was caught by checking the merge behaviour empirically rather than assuming it, and the fix ships with a test that asserts all twenty slots stay filled.

## The verification step that could not fail

The install script printed its own verification recipe. Run Claude Code against a help invocation of the remote-shell command, and expect a prompt that names the ask rule.

After the verb-scoping change, that prompt could never come, so a correct install now looked like a failed one. That is the visible half of the problem. The invisible half is that the recipe had never been a test at all. A help invocation is harmless by construction, so the classifier waves it through whether or not the settings file loaded. The check passed the same way in both worlds, which means it distinguished nothing.

It was replaced with two probes that can each fail. The first is a destroy verb aimed at an application that does not exist: gated, so it must prompt, and harmless if it runs anyway. The second is an ordinary list command against a real application, which must reach the classifier rather than prompt. The second probe names all three possible outcomes, including the dangerous one: if it runs silently with no classifier involvement at all, an allow grant is shadowing the classifier and you have just found one of the grants described above.

Then the rest of the repository was swept for the same staleness rather than fixing only the file we had opened. Two documentation lines and a test comment describe the old rules deliberately and were left; one venture overlay still names the remote-shell subcommands and is now the primary gate for them, so its prose matters more rather than less.

## What a gate is for

A permission prompt is a request for a human judgment. Its cost is not the second it takes to answer. Its cost is the credibility of the next prompt.

At fifty-seven stops in one session, the prompts are no longer requests for judgment. They are a rhythm, and the operator's job has become clearing them. The security property the gate was installed to provide, which is that a human considers this specific action before it happens, has been consumed by the volume of the gate's own false positives. Fewer prompts, every one of them on something that genuinely mutates production, is a stronger control than a wall of prompts on reads.

And the recipe you verify it with has to be able to come back negative. A safety mechanism nobody can falsify is indistinguishable from one that is not installed.
