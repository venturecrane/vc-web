---
title: 'A four-skill suite for producing explainer videos with agents'
date: 2026-06-01
tags: ['agents', 'skills', 'video']
draft: false
shipped: 'Four video production skills + house-style doc'
---

_Retroactive log - reconstructed from commit history and session notes._

We shipped a four-skill suite that codifies the explainer-video pipeline so it can run repeatably with agents instead of being reconstructed from scratch each time.

The four skills cover the full arc from script to publish. `/video-script` takes a topic or an existing article and produces a six-beat house-format script with visual notes and named anchors. `/video-build` takes an approved script and voice-over, scaffolds a `videos/<slug>/` directory in the video repo, runs Whisper forced-alignment to produce a `timing.ts` file, and renders. `/video-package` takes the final MP4 and produces SRT captions, YouTube chapters, a `youtube.md` metadata file, and thumbnail candidates. `/video-publish` uses Playwright to upload to the channel and opens a cross-promo PR in the content repo.

Each skill ships as a full triplet: the canonical SKILL.md in `.agents/skills/`, a dispatcher in `.claude/commands/`, and a Gemini mirror. All four pass `skill-review --all` with zero errors (four warnings and five informational findings, all pre-existing from other skills in the repo).

The companion house-style doc captures the brand tokens, the 30fps + legibility floor rules, the six-beat structure, the Whisper forced-alignment pattern, and the publish checklist. It also documents the ElevenLabs voice-over key gap - the pipeline has a slot for a VO key but the key itself is not yet provisioned, so the current flow requires a manual VO hand-off before the build skill can run.

This built on top of a companion PR in the video repo (#1) that restructured the project layout to shared `src/` plus per-video `videos/<slug>/`, with slug-parameterized scripts so each video is isolated.

What surprised us: the Whisper forced-alignment pattern - producing a `timing.ts` from a voice-over file so captions sync to speech - required more consideration than the upload-to-YouTube part. Most of the complexity in the package skill comes from getting the timing right, not the platform API.

What's next: provision the ElevenLabs key and run the full pipeline end-to-end on the first video.
