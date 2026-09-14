---
title: 'July in review: killing the lead machine'
date: 2026-09-17
tags: ['agent-operations', 'architecture', 'process', 'observability']
draft: false
shipped: 'The automated lead-generation machine retired root and branch; first-touch ad attribution, conversion events, and consent hygiene shipped in one day; six go-live blockers closed on the pilot customer deployment; a retired persona name removed from every layer that still held it'
---

_Retroactive log covering July 1-15, 2026, published September 17, 2026. Reconstructed from merged pull requests, incident records, and session notes._

The first half of July was mostly deletion. One venture spent months building an automated lead-generation machine, and the decision that opened the month was to take all of it out.

## The lead machine is gone

The machine was two crawler workers, a thirteen-module enrichment pipeline, a scoring and qualification layer, machine-drafted outreach, and an admin cockpit to tune the whole thing. A live audit on July 1 found roughly 358 entity rows that were overwhelmingly noise, about 10 of 92 crawler-sourced leads reachable by email, and zero real outbound conversion signal ever recorded. The canonical failure the audit names is a scored hot lead that turned out to be a sign-maker advertising its own craft.

The structural problem was inference. A lead was an algorithm's guess about invisible operational pain, never checked against what the business actually was. Every close inspection found nothing there, and each look regenerated the false confidence.

The decision recorded in the architecture record was to keep nothing just in case. Two pull requests did the work. The first retired the two structurally wrong pipelines and ripped out the dead configuration around them, including a geography and vertical-targeting config block that the admin form stored and no worker ever read, at minus 10,628 lines. The second cut the machine out below the shared client-record spine, at minus 25,074. The surviving record is untouched because a prospect and a client are the same row at different stages, and quotes, engagements, invoices, billing, and the customer deployment all key off it. The lead board survives as a manual worklist.

## Paid acquisition, built in a day

July 5 shipped four gates from a new paid-acquisition decision, in order, in a single day.

Attribution capture went in at the middleware layer: a landing that carries any enumerated campaign parameter sets a first-party cookie for ninety days, and an existing cookie is never overwritten. The parameter list is enumerated, values are length-capped and stripped of control characters, decoding fails closed, and a test pins the key list so it cannot silently widen. The intake and booking endpoints read the cookie server-side, so the browser never sends attribution back.

The conversion layer followed: server-side conversion events on intake and booking success, with a server-minted event id returned to the page so the browser twin deduplicates against it. The email address is normalized and hashed before it leaves, pinned by a test that the raw address never appears in the payload. Unconfigured means the send is never attempted and the result says so, rather than a no-op reporting success.

Then analytics conversion events, and then the consent work. The privacy policy now discloses the attribution cookie in language that is true both before and after any campaign runs, the global privacy control signal is honored at load, and a share opt-out page shipped with it. The sequencing is load-bearing and was written down: the policy has to deploy before the pixel identifier is ever set.

## Go-live blockers

Six issues closed against the pilot customer deployment in the week of July 13.

The one worth reading is a self-sustaining loop. A routine wrote a note to a record in the customer's system of record, the write came back as a change webhook, and the routine woke and wrote another note. It ran every ten to twenty minutes for three hours overnight with nobody driving the seat, and twice it branched into two parallel sessions. Only the vendor's webhook latency throttled it, and it stopped at a restart rather than by design. The fix is a self-actor guard at the routing spine, gated deterministically on the event's own origin so the model never wakes at all, with a per-record cooldown and a daily wake cap as backstops.

Two findings came out of a live-substrate verification pass rather than from reading code. Reprovisioning read the operative per-customer configuration from git and uploaded it to object storage, which was the reverse of the design as it then stood, so any live change would be silently reverted by the next reprovision. That design was itself reverted later, and git is now authoritative. And the credential custody audit that was verified for one connector had never been repeated for the other three, which still sat in the gateway environment.

The cost breaker turned out to be unable to fire. The exact-cents enforcement lives on the durable-job path, that path is not entitled on any seat, and the path production traffic actually takes carries no token counts to meter. A live trip-fire probe proved the gap that seventeen passing unit tests could not.

## A name removed four times

A retired persona name was removed four separate times, and monitoring still paged on it twelve days after the fourth removal.

Each removal was real at the layer it touched: the display name, then the database projection, then the repository slug plus every active reference plus a CI guard banning the word. None of them reached the persistent volume, which keeps profile homes and cron stores across reprovisions by design. Each completion report was honest about the artifact and wrong about the job.

The rule written down afterwards enumerates the layers a removal has to clear, and requires a negative probe of each runtime layer rather than the diff that deleted it from source. The durable fix is not a sweep. A boot assertion now compares the profile homes present on the volume against the personas authored in configuration and exits non-zero on drift in either direction, so the layer converges on authored state instead of being cleaned once.
