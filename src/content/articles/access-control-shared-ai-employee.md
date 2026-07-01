---
title: 'The Grant Table Is the Kill Switch: Access Control for a Shared AI Employee'
date: 2026-07-01
description: 'Several people share one autonomous agent: the identity provider proves who they are, but a grant read live on every request decides whether they still get in.'
author: 'Venture Crane'
tags: ['security', 'agents', 'architecture', 'access-control', 'ai-employee']
draft: false
---

An identity provider tells you who someone is. It does not tell you whether they should still have access. Those are two separate decisions, and the most common way to get access control wrong is to let the first one stand in for the second. This came up while wiring a chat connector for an AI employee product, where several people at a customer firm share one autonomous agent, and the question that forced the design was not "how does a person sign in" but "how is that person's access severed the day they leave."

## The shape of the problem

The product runs one isolated deployment per customer. Inside that deployment lives a single autonomous agent that does real work on the firm's behalf, and the firm's own staff reach it through a chat connector - a remote MCP server exposed to Claude as a custom connector. The agent is shared. Five people at a professional-services firm might all direct the same agent, and each of them needs to be granted access on their first day and cut off on their last.

Two facts about the plumbing constrained everything that followed.

First, a Claude custom connector authenticates one of two ways: fully authless, or per-user OAuth with mandatory user consent. There is no connector-level shared machine credential and no machine-to-machine path. Authless is a non-starter for a connector that reaches sensitive business data, so every firm connection is per-user OAuth. Each person who adds the connector goes through their own sign-in.

Second, we use Clerk as the identity provider, and Clerk's OAuth access tokens are one-day JWTs whose refresh tokens never expire. Once a refresh token has been issued to a user, it can linger indefinitely. That is fine for a consumer app where the user owns their own account. It is a problem when the account belongs to an employee who might be terminated, and the token in their Claude client keeps minting fresh one-day access tokens long after they have walked out the door.

## The token cannot be the gate

Put those two facts together and the conclusion is forced: the token cannot be the thing that authorizes access, because we do not control its lifetime. A per-user OAuth token is proof that Clerk once verified this person's email. It is not proof that the firm still wants them talking to its agent. If we treat "holds a valid token" as "is allowed in," then revoking someone means somehow reaching into Clerk's token machinery and killing a credential that was designed never to expire. That is the wrong layer to fight at.

The move is to stop asking the token to carry authorization at all. Login proves who. A separate grant decides whether, and until when. We keep those two jobs in two different systems: the identity provider owns login and token crypto, and our own grant table owns the allow decision.

## The grant table is the gate, and the kill switch

Authorization is a row. When a person is allowed to reach a customer's agent, there is a record for them in a grants table (`mcp_issued_grants`), and that row is read live on every single MCP request. Not cached at login, not baked into the token, not trusted from the session - read fresh, per call, against the authoritative store. The agent's configuration is already loaded live rather than snapshotted, and authorization rides the same posture.

Because the grant, and not the Clerk token, is the gate, two properties fall out that a token-based design cannot offer.

An explicit revoke cuts on the next call, within seconds. An administrator flips the row to revoked, the next request from that user reads the revoked state, and access is gone - regardless of the one-day JWT still sitting valid in their client, regardless of the refresh token that will never expire on its own. We do not need token introspection, opaque tokens, or a callback to the identity provider. The kill switch is a database write, and it is instant because the read is live. This is the central correctness property of the whole design, and the one thing that must never regress: the moment the token becomes the gate again, the kill switch stops working.

Grants are bounded. Every row carries an `expires_at`, and it is never null. There is no "forever" grant. In the shipped build the TTL is clamped to a `[1, 90]` day window, and open-policy grants get a shorter ceiling still. A grant that lapses is not renewed silently; renewal is a fresh sign-in, which brings us to the second half of offboarding.

## Offboarding rides the mailbox

Sign-in is a Clerk email-link, or more precisely a one-time code delivered to the person's firm mailbox. No password, no key. The identity being proven is possession of the live firm email address. That choice does more than avoid password management: it hands offboarding to a system the firm already runs perfectly.

When someone leaves, the firm disables their mailbox. That is an action every organization already takes on the last day, reliably, as part of a process that exists whether or not our product is in the picture. Because every grant is bounded and renewal requires a fresh email-link sign-in, a person whose mailbox has been killed cannot complete the re-auth when their grant lapses. Their access decays on its own inside the TTL window, with no action required from anyone on our side. Set the session lifetime to the grant TTL and that re-auth is forced at a known cadence.

So there are two offboarding paths, and they are layered on purpose. The explicit admin revoke is the immediate, authoritative cut. The mailbox-possession lapse is the passive backstop that catches the case nobody remembered to revoke. We do not lean on the passive path as the primary control - the bounded `expires_at` plus the explicit revoke is the authoritative story, and the passive lapse is secondary until the token-lifetime assumptions behind it are verified empirically. But designing offboarding so it can happen without us carrying the burden is the point of routing identity through the firm's own mailbox.

## Proven beats clever

An earlier version of this design was more clever. The agent itself would mint a signed sign-in ticket and thread it into Claude's OAuth flow, so a firm could hand its people a one-click path without a mailbox round-trip. It was elegant. It was also a new, unproven seam with a spoofable inbound sender surface and a bearer-token-in-an-inbox risk, none of which the documented email-link path carries.

We demoted the bespoke ticket to optional sugar and shipped on the identity provider's documented email-link login instead. The email-link path is a native sign-in strategy on the platform we already use - a configuration toggle, not a hand-rolled protocol. The transferable version of this: when a security-critical path can be built from a documented, already-proven primitive or from a bespoke mechanism you find pleasing, the bespoke mechanism has to earn its seam against the failure modes the proven path simply does not have. Ours could not, so it lost.

## The agent is not a permission proxy

One category error is worth naming because it is easy to back into. A shared agent authenticates to the firm's systems - its practice-management system, its document store - as one firm-level identity. It does not inherit each caller's individual permissions. When five people share the agent, they are not five scoped sub-identities; they are five people authorized to direct one identity that has the access it has.

That means the grant table answers exactly one question - may this person reach this customer's agent at all - and it must not be mistaken for a per-user permission system that scopes what the agent will then do on their behalf. Conflating the two invites a false sense that the access model is also an authorization-scoping model. It is not. Fine-grained "who may ask the agent for what" is a separate obligation, and pretending the firm-level identity is a per-user proxy is how you end up believing you have controls you never built.

## The transferable lesson

If you run a shared autonomous agent that several people reach through their own authenticated sessions, do not let the identity provider's token be your access control. Let it prove identity, and nothing more. Put the allow decision in a table you own, read it live on every request, and make revoking a row the kill switch. Bound every grant with a real expiry and refuse the idea of a permanent one. Route identity through a credential the customer already de-provisions on offboarding - a mailbox is a good one - so access decays without you having to chase it. Prefer the documented sign-in primitive over the clever bespoke one. And keep the question the access table answers narrow: whether someone gets in is not the same as what the shared identity is then allowed to do.

The token proves you were let in once. Whether you are still allowed is a different fact, and it has to live somewhere you can change in one write.

---

_We build isolated per-customer AI employees, with staff access brokered through a Claude custom connector (a remote MCP server) over per-user OAuth on Clerk, authorized by a live-read grant table with an immutable change ledger. This describes access-control work landed on 2026-06-27 (the grant table, live-read authorization, bounded TTLs, admin revoke, and issuance policy); the open-by-domain just-in-time grant path is built and tested but not the operating policy for the current pilot (which ships on allowlist), and the end-state cutover to a customer's own managed directory is staged, not shipped, and an earlier screening-attestation gate was removed as out of scope for a use-at-your-own-risk product._
