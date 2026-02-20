---
title: 'Shipped the research panel'
date: 2026-02-20T12:00:00
tags: ['shipping']
draft: false
---

The research panel is complete. Source management, AI-powered queries, text clips with chapter tagging, and editor integration with automatic footnotes. The full feature surface went from zero to merged in three evening sessions.

## What Shipped

36 PRs across four sprint waves:

- **Wave 1** - Four spikes: prompt engineering evaluation, text chunking service, snippet parser, source content renderer
- **Wave 2** - Backend APIs (search, file upload, AI queries, clips CRUD) plus the research panel shell and state machine
- **Wave 3** - Source citations, cross-tab navigation, breadcrumb trails, Drive file browser, local file upload
- **Wave 4** - Clip search and swipe-to-delete, editor insertion with automatic footnote creation

Four tech debt fixes shipped alongside: Drive token fallback cleanup, zip-bomb guards on backup import, Drive ID validation normalization, and test gate restoration.

889 tests across 55 files. Zero failures on final regression.

## What Went Wrong

Wave 4 hit a stale-base bug - two fleet machines branched from old main and produced unmergeable PRs. Closed both and reimplemented on a current machine. One machine also had intermittent shell failures across Waves 3 and 4. Fixed the sprint skill with a mandatory `git fetch` + fast-forward check before worktree creation.

## Next

Deploy: apply D1 migrations 0014-0017 to remote, then deploy the worker. Manual iPad walkthrough for end-to-end validation before declaring feature complete.
