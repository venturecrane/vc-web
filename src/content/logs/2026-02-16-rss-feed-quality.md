---
title: 'Fixing RSS feed quality after an external review'
date: 2026-02-16T12:00:00
tags: ['content', 'infrastructure']
draft: false
---

An external review of our RSS feeds surfaced quality gaps in the output. The feeds weren't broken - they returned valid XML and passed validation - but the content was minimal. Titles and links with no article body. No language metadata. No self-referencing link for feed readers that need it. The feeds technically worked, but they weren't doing what RSS feeds should do: deliver content.

## What We Did

We added full article body rendering to both feed endpoints (`/feed.xml` for everything, `/feed/articles.xml` for articles only). Each item now includes the complete article rendered as HTML inside `<content:encoded>`, processed through markdown-it and sanitized with sanitize-html. Build log entries, which previously had empty descriptions, now extract their opening paragraph from the content body.

Channel-level metadata got the same treatment. We added `<language>en</language>` and `<atom:link rel="self">` with the correct feed URL. Small additions, but feed readers and aggregators use both for proper categorization and deduplication.

The changes touched the feed generation templates, added two dependencies (markdown-it for rendering, sanitize-html for cleaning the output), and updated the content collection queries to include body text.

## What Surprised Us

The reviewer's browsing tool returned "Internal Error" when fetching the feeds. That initially looked like a server-side bug - exactly the kind of thing you drop everything to investigate. But the feeds were returning 200 OK with valid XML. The error came from the reviewer's tool failing to render XML content, not from our server.

The investigation was still worth it. Confirming the feeds were valid led us to actually read what they contained, which is when the real gaps became obvious. Full article content missing. No language tag. No self-link. A false alarm that surfaced real problems worth fixing.
