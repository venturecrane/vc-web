---
title: 'A 40-PR weekend on a marketing surface'
date: 2026-05-04
tags: ['agent-operations', 'iteration-loop', 'shipping']
draft: false
---

Over a long weekend - three days, roughly 40 pull requests - one Claude Code session ran a continuous shaping pass on a venture's marketing surface. No big-bang redesign. No batch review. PR after PR, each landing one focused change, each reviewed live in the browser before the next one opened.

This is the operational record of that cadence and what it surfaced about iteration loop speed.

## The surface and the state it was in

The venture's marketing site had been live for a couple of weeks in a rough state. Sections were placeholder-heavy. Voice was inconsistent. The intake path was overloaded - general inquiries and lead capture were routed through the same form, which was wrong for both. A handful of things were broken in ways the Captain could see immediately but hadn't prioritized over backend work.

The weekend opened a gap in the calendar. We ran it.

## What the 40 PRs covered

No two PRs were the same kind of change. The range:

**Voice and copy.** Home page sections rebuilt in first-person. Ledes tightened. A typography sweep applied `text-balance` to headlines and `text-pretty` to body copy. Two sections killed - they didn't earn their slot and the Captain confirmed that on first look.

**Intake restructure.** Split one overloaded form path into two distinct routes: general communication and lead capture. Each now has its own entry point, its own fields, and its own confirmation path. Cleaner for the visitor; cleaner for the backend.

**Voice input.** Added voice-input capability to one of the intake forms. One PR for the feature, one follow-up for a field behavior edge case caught on review.

**Perceived load.** The bot-defense widget was initializing on first focus, which produced a visible lag. Moved initialization to idle time. The form now feels instant.

**Image optimization.** One image had slipped through at 535 KB. Compressed to 53 KB. No visible quality change.

**Legal pages.** Terms and Privacy polished - tightened prose, fixed formatting inconsistencies, removed a section that no longer applied.

**Wordmark.** A regression had knocked out the wordmark. Restored.

**Analytics.** Activated. One PR to wire the property; one follow-up after verifying the event stream was clean.

**Auth flow.** Cookie collision fix - a returning visitor path was broken by a cookie naming conflict. Resolved.

**Retired one surface.** A feature that had been live was breaking the returning-visitor experience in a way we couldn't patch without a larger refactor. Retired cleanly. Removed the entry point, cleaned up the routes, updated the nav.

## The cadence mechanics

The session ran continuously. Review arrived in minutes because the Captain was reviewing in the browser after each merge, not batching feedback for a Friday call. That review signal fed directly into the next PR scope. When a PR landed and something was still off, the next PR addressed it. No waiting. No "we'll circle back."

Three things held the loop together:

**Each PR was small enough to review in one screen of diff.** Larger PRs slow the loop because review slows. A PR that touches five files in three areas is hard to review quickly. A PR that changes one thing is trivial to review and trivial to revert if it's wrong.

**The Captain reviewed live, not in batch.** This is the asymmetry that makes agent iteration different from a human design cycle. Human reviewers batch feedback because synchronous review is expensive. A Claude Code session running in a background terminal costs nothing to leave running. The Captain can review, react, and type a single sentence of direction. The agent turns that sentence into a PR.

**The architecture supported PR-sized changes.** Surface and data were separable. Styling changes didn't require backend changes. Copy changes didn't require schema changes. Each PR had a bounded scope because the underlying structure made bounding possible. If those layers had been tangled, every PR would have pulled in more than it should have.

## The lesson worth sharing

Iteration loop speed dominates everything else when you are shaping a marketing surface. Big-bang rewrites are a human design tradition - they exist because review cycles are slow and committing to a PR feels expensive. When a design review happens once a week, the batch size grows to justify the meeting.

Agents don't carry that cost. They can take direction one PR at a time, ship, and ask what's next. Forty PRs is not a throughput claim. It is a description of what happens when you remove the friction that made batching necessary in the first place.

## What's not done

The venture is still in stealth. The 40-PR sprint shaped the surface; it did not decide when to go public. That is a separate decision, driven by readiness criteria that have nothing to do with whether the home page copy is right. The visibility switch stays off until it is ready to be flipped.
