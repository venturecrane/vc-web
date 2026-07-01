---
title: 'What an Agent May Do Is Not How It May Start'
date: 2026-07-01
description: 'One authorization setting was answering two unrelated questions. Splitting exposure from initiation is what made the entitlement model enforceable.'
author: 'Venture Crane'
tags: ['security', 'agents', 'architecture', 'configuration', 'ai-employee']
draft: true
---

A single setting in our AI employee product had been answering two questions that have nothing to do with each other. One question is what class of action the agent is allowed to send into the world, and how far. The other is how a given piece of work is allowed to begin. For a while both of those lived inside one scalar knob per skill, plus a scatter of per-action, per-scope, and per-mailbox overrides. It looked like one authorization model. It was two, badly interleaved, and the interleaving is what kept it from being enforceable.

The product is a per-customer agent configured by a YAML file: which personas exist, which skills are enabled, what each is entitled to do. Entitlements are the part that has to be exactly right, because they are the boundary between an agent that drafts a reply for a human to send and an agent that sends it. The rebuild described here retired the old knobs entirely and replaced them with two independent axes. The general lesson is the one worth carrying off: an authorization model rots the moment one setting is asked to answer two questions.

## The conflated knob

The original model expressed authority as a ceiling attached to a skill. A skill had a `trust_ceiling`. Skills could carry `action_ceilings`. Scopes had their own `scope.trust_ceiling` and `scope.action_ceilings`. Managed mailboxes carried `action_ceilings` too, and provisioning had a `skill_trust_ceiling` on top of all of it. Any one of those fields, read in isolation, looked reasonable. Read together, they were four or five places that could each raise or lower what an agent was permitted to do, with no single artifact you could point at and say "this is what this persona may send."

Worse, the ceiling was trying to encode two facts at once. "This skill runs autonomously" was being used to mean both "this skill may take autonomous action in the world" and, implicitly, "this skill may fire on its own." Those are different properties. A skill that triages an inbox might be allowed to run on a schedule without a human present, yet only ever be entitled to draft, never to send. A skill that sends external mail might be highly restricted in how it starts but, once a human starts it, allowed to commit. A scalar ceiling cannot represent that. It collapses two axes onto one number, and any model that collapses two independent variables into one is going to be wrong for every case where the two variables disagree.

The practical symptom was that the model was not enforceable as a flag-day runtime contract. You could not take a persona's configuration and mechanically decide, at the moment an action was about to leave the system, whether it was allowed. Too much depended on which of the overlapping ceilings won.

## Exposure is a property of the persona

The first axis is exposure: what class of action may reach the world, and at what ceiling. Exposure is declared on the persona, not the skill, because it is a property of the identity the agent is acting as, not of any one task it performs.

```yaml
personas:
  - slug: marcus
    entitlements:
      exposure:
        internal_write: autonomous
        external_send: draft_for_review
    skills:
      - name: inbox-triage
        enabled: true
        initiation:
          manual: true
          scheduled: false
          webhook: true
```

Two design choices in that block carry the whole safety argument. First, `exposure` is sparse. It lists only the action classes that have been deliberately configured. `internal_write` and `external_send` appear here; anything not listed is simply absent. Second, and this is the load-bearing part, a missing action class fails closed at runtime and renders as unconfigured in the UI. If a persona has no entry for a given class of outbound action, the agent cannot take that action. Not "defaults to a safe ceiling" - has no entitlement at all, and the enforcement layer refuses it.

`read` is the one exception, and it is an exception by omission. Reads are never customer-authored. Enforcement always allows them, so there is no `read` line for anyone to get wrong. The only things a human writes into exposure are the classes that can actually change something outside the system.

## Initiation is a property of the skill

The second axis is initiation: how an enabled skill is allowed to start. This one genuinely belongs to the skill, because "may this run on a cron" and "may a webhook trigger this" are facts about the task, not about the identity. Every enabled skill declares three booleans:

- `initiation.manual` - a person may start it on demand
- `initiation.scheduled` - a cron entry may start it
- `initiation.webhook` - an inbound event may start it

The enforcement rule is mechanical and reads straight off the config. A cron entry is only honored if the target skill has `scheduled: true`. A webhook trigger is only honored if the skill has `webhook: true`. An on-demand surface only appears if `manual: true`. There is no ceiling to reconcile and no inheritance to trace. The question "can this event start this skill" has exactly one place to look.

Separating the two axes is what makes each one legible. Exposure answers "if this runs, what may it do to the world." Initiation answers "what is allowed to make this run." Neither can quietly stand in for the other, because they no longer share a field.

## Fail-closed on the sparse case is the safety property

It is worth being precise about why the sparse-plus-fail-closed design is the safety property and not just a tidiness preference. The dangerous state for an authorization model is the unconfigured one: the action class nobody thought about, the persona that was set up before that class existed, the migration that half-populated a record. A model that fills those gaps with a default is making a decision on the operator's behalf at exactly the point where the operator expressed no intent. If the default leans permissive, the gap is a hole. If it leans restrictive, you have hidden a real capability behind an invisible default and someone will "fix" it by loosening the wrong thing.

Sparse exposure refuses to guess. An unconfigured action class is not a permissive default and not a silent restrictive default. It is visibly unconfigured in the UI and hard-denied at runtime. The absence of a decision is treated as the absence of authority, which is the only reading that is safe when you do not know why the field is empty. This is the same instinct as a schema that fails closed on fields it does not understand: the system that treats an absent rule as "deny" is the system that does not turn a data gap into an exposure.

Two floors sit underneath all of this and do not move. Vertical compliance floors may only narrow exposure, never widen it, so an industry's boundary cannot be raised by a persona edit. And current-turn approval floors for `commitment` and `destructive` actions remain hard runtime floors regardless of exposure. Exposure decides how far a persona may generally go; these floors are the lines that a per-customer setting is not allowed to cross at all.

## Breaking cleanly, with no shim

The rebuild retired `trust_ceiling`, `action_ceilings`, `scope.trust_ceiling`, `scope.action_ceilings`, the mailbox-level `action_ceilings`, and provisioning's `skill_trust_ceiling`, with no compatibility shim. Validators now reject those names as legacy entitlement fields. A config written against the old model does not degrade or get silently reinterpreted; it fails validation and has to be rewritten against the two-axis model.

That refusal to bridge is deliberate. A compatibility shim on an authorization model is a translation layer that has to decide what an old ceiling "meant" in the new world, which reintroduces exactly the guessing the new model was built to eliminate. When the field in question is the boundary between drafting and sending, a wrong guess during translation is not a cosmetic bug. The safer move is a hard cutover: reject the legacy shape, force each config to be re-expressed as explicit exposure and explicit initiation, and let the validator be the thing that guarantees no half-translated authority survives.

## The transferable lesson

When one setting answers two questions, it will be wrong for every case where the two answers disagree, and you will not be able to enforce it mechanically because enforcement requires knowing which question you are answering. The fix is not a better default or a smarter ceiling. It is to find the second question hiding inside the first and give it its own axis. Here that meant separating what a persona may expose to the world from how a skill may be started, making exposure sparse so that an unconfigured action class fails closed instead of defaulting into a decision nobody made, and cutting the legacy fields off at the validator rather than translating them. Any authorization model is a set of independent questions; the failures come from pretending two of them are one.

---

_This is a config-model rebuild shipped end to end: the two-axis entitlement schema, the sparse fail-closed exposure enforcement, per-skill initiation, and the validator rejection of the retired ceiling fields are built and in use. The governance audit vocabulary is now `entitlement_exposure`, `entitlement_initiation`, and `skill_enabled`. One thing the split leaves open by design: a future promotion surface must promote exposure or initiation explicitly, because with the scalar ceiling gone there is no longer a single number to raise._
