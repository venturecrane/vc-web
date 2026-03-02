---
title: 'From Code Review to Production in 48 Hours'
date: 2026-02-22
description: 'How AI agents executed a full product sprint - from code review through production deploy - in 48 hours for a writing app.'
author: 'Venture Crane'
tags: ['sprint', 'agent-workflow', 'code-quality']
draft: false
---

A code review graded a codebase at C. Forty-eight hours later, the same codebase was in production with security hardening, a rich text editor, Google Drive integration, PDF and EPUB export, progressive AI features, and 179 tests across frontend and backend. Thirty-one pull requests merged across two days.

The codebase was an iPad-first writing app for nonfiction authors. It had an existing foundation - authentication, basic editor, chapter structure - but the code review exposed real problems. A D in testing. Cs in security, architecture, and code quality. Drive query injection vectors in the Google Drive integration. A monolithic page component north of 1,200 lines. Near-zero test coverage on critical paths.

What happened next was not a hackathon. It was a structured sprint where the code review findings became the work queue, ordered by severity, and AI agents worked through it systematically.

---

## The Code Review as Sprint Plan

Most code reviews produce a document that sits in a wiki. Someone reads it, nods, and adds items to a backlog that competes with feature work for prioritization. The findings age. The context fades. Three months later, the missing tests are still missing.

We treated the code review differently. The seven-dimension rubric - architecture, security, code quality, testing, dependencies, documentation, standards compliance - produced graded findings with concrete thresholds. Each finding mapped directly to a unit of work. The grades determined the order.

Testing got a D - near-total absence of test coverage across both frontend and backend, with zero frontend tests and no tests for core business logic. Security got a C, with Drive query injection vectors, missing Content Security Policy headers, no rate limiting, and unvalidated OAuth redirect URIs. These became the first PRs of the sprint - not because security is abstractly important, but because a D in any dimension pulls the overall grade downward regardless of everything else. Fix the D first, and every subsequent PR improves the codebase from a higher baseline.

Architecture got a C. The main page component was over 1,000 lines, mixing editor logic, settings management, AI features, and export handling in a single file. This informed the refactoring strategy throughout the sprint - every feature PR was an opportunity to extract, not accumulate.

The code review did not just tell us what was wrong. It told us what to fix first.

---

## Day 0: Security Foundation

The instinct with a new product sprint is to build the exciting features first. Rich text editing, AI-powered rewrites, Google Drive sync - that is the fun work. Security headers and rate limiting are not fun. They are also not optional when your code review hands back Cs and Ds.

The first PRs addressed every security finding from the review:

**Content Security Policy headers.** The app had no CSP. A malicious script injection - through a crafted document title, a compromised CDN, an XSS vector in the editor - would execute without restriction. The fix was a strict CSP that whitelists known origins for scripts, styles, fonts, and connections. This is a configuration change, not a feature, but it is the difference between "a vulnerability is exploitable" and "a vulnerability is mitigated by defense in depth."

**Rate limiting.** The API had no request throttling. An attacker - or a misbehaving client, or a user's own sync loop gone wrong - could hammer endpoints without limit. Rate limiting went onto the authentication and AI endpoints, the two highest-value targets.

**OAuth redirect validation.** The OAuth flow accepted redirect URIs without validation. An attacker could craft a login link that redirected the OAuth token to their own server. The fix validates redirect URIs against a whitelist of known origins before initiating the OAuth flow.

These three changes - CSP, rate limiting, redirect validation - addressed the security findings while the sprint focused on raising the testing grade from D. They established the pattern for the rest of the sprint: fix the foundation before building on it.

The same session built the core features that the security hardening was protecting. A rich text editor with formatting toolbar. A three-tier auto-save system - local state, debounced API writes, and periodic full-document sync - so writers never lose work. The initial AI rewrite feature with a floating action bar and server-sent events for streaming responses. Text selection handling tuned for iPad, where selection behavior differs from desktop browsers in ways that only surface when you test on the actual device.

---

## Day 1: Thirty-One PRs

PRs #59 through #95 merged across February 16 and 17. That is thirty-one pull requests in two days, each one a scoped unit of work: one feature, one fix, or one refactoring. Not a monolithic "day 1 features" branch. Thirty-one individual, reviewable changes.

The volume is notable but the sequencing is what matters. Each PR built on the security foundation from Day 0. Every new feature inherited the CSP headers, the rate limiting, the redirect validation. Security was not a follow-up task - it was already in the codebase before the first feature PR of Day 1.

### Google Drive Integration

The full OAuth-to-export pipeline shipped in a single day. Connect your Google Drive account via OAuth. The app auto-creates a book folder in Drive on first export. Export your manuscript as PDF or EPUB and save it directly to your Drive folder. Browse files already in your book folder. Disconnect with proper token revocation - not just clearing the local token, but calling Google's revocation endpoint so the authorization is truly removed.

Token revocation is the kind of detail that gets skipped in a fast sprint. It is easy to implement "disconnect" by deleting the stored token and calling it done. The user sees a disconnected state, the UI looks right, but the OAuth grant is still active on Google's side. If the token is later compromised, it still works. Proper revocation is an HTTP call and an error handler. It took ten minutes to implement and it closes a real security gap.

### Export Pipeline

PDF export uses Cloudflare's Browser Rendering API. Instead of a PDF library that approximates the document layout, the app renders the manuscript as HTML with print-optimized CSS, then uses a headless browser to generate the PDF. The output matches exactly what the user sees in the editor preview. No layout surprises, no font substitution, no "it looked different in the app."

EPUB export builds the package from scratch using JSZip. The EPUB format is a ZIP archive containing XHTML content files, a package manifest, and metadata. Building it programmatically means the output validates against EPUB readers without depending on a third-party EPUB library that might not handle edge cases in manuscript formatting - things like scene breaks, chapter epigraphs, and front matter.

Both export formats support two destinations: local download to the device, or save to the connected Google Drive folder. The user chooses at export time.

### Chapter Management

Rename chapters inline - click the chapter title, edit, press enter. Delete chapters with last-chapter protection - the app prevents deleting your only remaining chapter, which would leave a book with no content. Drag-and-drop reorder for chapter sequencing, which required careful state management to keep the editor, the chapter list, and the backend in sync during the drag operation.

### Auth and Session Handling

Sign-out that actually clears everything - cached data, service worker state, local storage, session cookies. When a user signs out of a writing app, they expect their manuscript data to be gone from the device. A sign-out that clears the session cookie but leaves cached chapter content in a service worker is not a real sign-out.

Thirty-day session persistence for the common case. Writers do not want to re-authenticate every time they open their iPad to write. The session token persists for 30 days with a sliding window, so regular usage keeps the session alive indefinitely.

### Progressive AI Architecture

The AI rewrite feature uses a two-tier model architecture that optimizes for perceived performance.

The primary model runs on Cloudflare Workers AI - specifically a lightweight model optimized for fast inference at the edge. When a user selects text and taps "Rewrite," the response starts streaming within sub-second time-to-first-token. The UI opens the rewrite sheet instantly, shows a blinking cursor to indicate the model is working, and streams tokens as they arrive. The user sees activity within a second of tapping the button.

For users who want a deeper rewrite, a "Go Deeper" option escalates to a frontier model. This takes longer but produces more nuanced rewrites - better at preserving voice, handling complex sentence structures, and making substantive improvements rather than surface-level rephrasing.

The key insight is that these serve different moments. A quick rewrite while drafting needs to be instant - the writer is in flow and any delay breaks concentration. A deep rewrite during editing can take a few seconds because the writer is already in a reflective mode. Two models, two latency profiles, two interaction patterns.

The streaming UX matters more than the model quality. An objectively better rewrite that takes four seconds to start displaying loses to a decent rewrite that starts in under a second. Writers will use the fast option ten times for every one use of the deep option, because speed keeps them in their creative flow.

---

## Day 2: Production Polish

The app was functional after Day 1. Day 2 was about making it production-ready - the difference between "it works" and "it works on an iPad that someone added to their home screen and uses every day."

### PWA Support

The app is an iPad-first product distributed as a Progressive Web App. Users add it to their home screen from Safari and it launches like a native app - full screen, no browser chrome, its own icon in the app switcher.

PWA support required a service worker for offline capability and asset caching, configured via Serwist (a modern service worker toolkit). The service worker pre-caches the app shell and fonts, caches API responses for offline reading, and handles the install prompt flow. The web manifest defines the app name, icons, theme color, and display mode.

Getting PWA right on iPad specifically required testing the add-to-home-screen flow, verifying the app launches in standalone mode (not inside Safari), confirming the status bar styling, and ensuring the service worker handles the app lifecycle correctly when iOS suspends and resumes the web app process. These are the details that determine whether a PWA feels like a real app or a bookmarked website.

### Multi-Book Management

The initial version supported a single book. Day 2 added a project dashboard with cards for each book, a project switcher in the editor, and full CRUD operations: create a new book, rename, duplicate (copying all chapters), and delete with confirmation.

The dashboard was a meaningful architectural addition. It introduced a project context layer above the existing chapter/editor hierarchy. Every component that previously assumed "there is one book" needed to become project-aware - the editor, the chapter list, the export pipeline, the Google Drive integration, the auto-save system.

### Extraction and Testing

The main page component that the code review flagged at over 1,000 lines got its first significant extraction. The settings menu - account management, Google Drive connection, export options, sign-out - was pulled into its own component. The page file went from 1,257 lines to 801 lines. Still large, but moving in the right direction. The extraction pattern established during this refactoring - identify a cohesive feature cluster, extract it with its own state management, connect it via props and callbacks - became the template for future extractions.

The test suite grew substantially on Day 2. Sixty-eight new tests across five test files, covering:

- Auth middleware: four tests verifying token validation, session expiry, and unauthorized access handling
- CORS policy: three tests confirming cross-origin behavior for the API endpoints
- Encryption: five tests covering the encrypt/decrypt cycle, key derivation, and error cases
- Component tests for the newly extracted settings menu and project dashboard

The final count: 108 backend tests and 71 frontend tests. Not comprehensive coverage, but meaningful coverage on the paths that matter most - authentication, data integrity, and the features an author interacts with every session.

---

## What the Numbers Mean

Forty-eight hours. Thirty-one PRs across two days. One hundred seventy-nine tests. Testing grade from D to B. A production-deployed iPad app with rich text editing, AI features, Google Drive sync, and multi-format export.

These numbers are real, but they are not the point. Fast output from AI agents is easy to achieve. You point an agent at a codebase and tell it to build features, and it will produce volume. The question is whether that volume is coherent, secure, and maintainable.

The sprint worked because of the structure around the speed.

**The code review ordered the work.** Security findings came first, not because someone made a judgment call, but because the grading rubric mathematically requires it - a D in any dimension pulls the overall grade downward. The rubric automated the prioritization that a human tech lead would have done manually.

**Each PR was scoped.** Thirty-one PRs in two days sounds chaotic. It is the opposite of chaotic. Each PR did one thing. "Add CSP headers" is reviewable. "Day 1 features" is not. Scoped PRs meant that if any single change caused a problem, it could be identified and reverted without unwinding a day of work.

**Security was the foundation, not an afterthought.** Every feature built on Day 1 inherited the security hardening from Day 0. The Google Drive OAuth flow benefited from the redirect validation. The AI endpoints benefited from rate limiting. Building security first meant every subsequent PR was building on a secure base.

**Deploy before polish.** The app went to production with core features before the PWA support, before multi-book management, before the settings extraction. This meant real users could start using the app while the polish continued. It also meant the polish was informed by production behavior, not assumptions about how the app would be used.

---

## Code Review as Sprint Planning

The transferable pattern here is not "AI agents can build fast." That is table stakes. The pattern is using automated code review as sprint planning.

A traditional sprint planning session involves a product manager, a tech lead, and a backlog of varying quality. The team discusses priorities, estimates effort, and commits to a set of work items. This process is valuable but subjective. Two different tech leads will prioritize the same backlog differently.

An automated code review with a structured rubric produces an objective severity ordering. Testing D, security C, architecture C - the work order writes itself. You do not need a planning meeting to know that you fix the D before you address the Cs. You do not need a tech lead to decide that missing test coverage is more urgent than a large file.

This does not replace product prioritization. The code review tells you what is wrong with the code. The product manager tells you what features to build. The sprint combines both: fix the security findings, then build the features, with each feature PR inheriting the fixes. The code review provides the engineering priorities. The product vision provides the feature priorities. They are complementary inputs to the same sprint plan.

For teams considering this approach: run the code review first. Before you write a single feature story, grade the existing codebase. The findings will tell you what technical work needs to happen before - or alongside - the feature work. That sequencing is the difference between a sprint that builds on a solid foundation and one that builds on known problems.

---

## What We Would Do Differently

Honesty about what did not go perfectly.

**The 1,257-line page component should have been extracted earlier.** The Day 2 extraction brought it to 801 lines, but 801 lines is still too large. The architectural C from the code review was partially addressed, not resolved. A more disciplined approach would have set a hard line - no component over 500 lines - and enforced it with every feature PR rather than deferring extraction to a polish day.

**Test coverage is adequate, not thorough.** One hundred seventy-nine tests across a full-featured writing app is a starting point. The critical paths are covered - auth, encryption, CORS, core components - but there are gaps in the export pipeline, the drag-and-drop interactions, and the Google Drive sync edge cases (network failures mid-upload, token expiry during export). These are the tests that prevent production incidents, and they are not written yet.

**The two-day timeline compresses learning.** When agents build fast, the team learns slowly. Each of those thirty-one PRs represents a set of decisions - API design choices, state management patterns, error handling strategies - that were made quickly by an agent optimizing for completion. Some of those decisions will need revisiting as the app matures and real usage patterns emerge. Speed of implementation is not the same as quality of decisions.

---

## The Uncomfortable Part

A two-day sprint from code review to production raises a question that the industry is still working through: what does this mean for traditional sprint planning, estimation, and team structure?

We do not have a complete answer. What we can report is what happened: a code review identified problems, the problems were prioritized by severity, AI agents worked through the queue, and a production app emerged in 48 hours. The features are real. The tests pass. The security hardening is in place. Users are writing with it.

Whether this changes how teams plan sprints, estimate work, or structure their engineering organizations is a bigger question than one sprint can answer. What this sprint demonstrates is that the mechanics work. Code review produces a prioritized work queue. AI agents execute against that queue. The output is a production application, not a prototype.

The interesting question is not whether AI agents can do this. They just did. The interesting question is what your team does with the time that opens up when the build phase compresses from weeks to days.

---

_The writing app went from a C code review to production in 48 hours. AI agents executed the sprint, merging 31 PRs across two days and producing 179 tests across frontend and backend. The code review rubric served as the sprint plan, with the testing D and security C addressed before feature work. The app is in production as a Progressive Web App._
