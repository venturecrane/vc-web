---
title: 'Writing app design sprint and editor panel'
date: 2026-02-25
tags: ['design']
draft: false
---

The writing app shipped a major design sprint: 30+ PRs merged, 25+ issues closed across Feb 24-25. The big pieces were the editor panel, design token system, author/editor metaphor revision, deep analysis pipeline, and accessibility polish.

## What We Did

### Design Token System

We broke the 1,132-line `globals.css` monolith into five scoped CSS files to eliminate merge conflicts during parallel agent sprints. The new structure: `globals.css` (52 lines) serves as the entry point and imports `editor.css`, `sources.css`, `editor-panel.css`, `components.css`, and `workspace.css`.

The refactor included migrating roughly 80 hardcoded Tailwind colors to semantic design tokens. Every color reference now maps to a CSS custom property with a semantic name (`--editor-panel-bg`, `--library-accent`, etc.), making theme changes surgical instead of search-and-replace operations across the codebase.

### Editor Panel

We replaced the bottom sheet with a persistent left-side Editor Panel for chapter-mode rewriting. The bottom sheet created virtual keyboard conflicts on iPad (the sheet would slide up, keyboard would overlap, text became inaccessible). The panel slides from the left instead, keeping edited text visible while the keyboard is active.

The panel uses violet as its accent color per the Design Charter spatial model (Editor=left/violet, Library=right/blue). It includes five default instruction chips and persists after accept/reject actions rather than auto-dismissing. 32 new tests cover panel state transitions, chip selection, and multi-turn rewrite flows.

We extracted a `PanelToggleButton` component as part of the migration. The old bottom sheet code and the toolbar "AI Rewrite" sparkle button are fully removed.

### Author/Editor Metaphor

Product-wide language shift from AI-as-tool to editor-as-collaborator. The tagline changed from "Get AI help when you need it" to "Work with an Editor who gets it." Onboarding tooltips were revised to emphasize the editor role. Per the Design Charter, we avoid "AI" in UI labels - the panel says "Chapter Editor" and the action is "Rewrite", not "AI Rewrite".

### Deep Analysis Pipeline

The inline analysis budget increased from 30K to 100K chars to handle larger documents without falling back to the job queue. For corpora exceeding 100K, we added a D1-backed map-reduce pipeline with concurrent batching (max 3 batches in flight), progress tracking, and synthesis.

The frontend polls the job queue and displays a progress bar during long-running analyses. A new `analysis_jobs` table tracks job state (pending/processing/complete/failed) and stores intermediate batch results.

### Accessibility and Polish

We ran a skip link and focus management audit. The toolbar received P0 fixes: touch targets expanded to 44px, toggle button contrast improved, easing curves added to state transitions. Exit animations were added to overlay panels (the editor panel, source detail sheets).

Two new hooks were extracted: `useFocusTrap` for modal-style panels and `useDropdown` for menu positioning. The Help & Support system now lives at `/help` with dedicated routes for FAQ, keyboard shortcuts, and contact.

We fixed a text selection persistence bug that caused selected text to deselect when the editor panel opened.

## What Surprised Us

The CSS file split eliminated merge conflicts but introduced a subtle import order dependency. `components.css` relied on tokens defined in `editor.css`, which broke when imported in the wrong order. We documented the dependency chain in a comment block at the top of `globals.css` to prevent future ordering bugs.

The bottom sheet removal uncovered a lurking race condition in the chapter mutation flow. The old sheet auto-dismissed on accept, which masked the issue. The persistent panel exposed it: rapid accept-then-edit actions occasionally stale-read the chapter text. We added a flush-and-refetch guard before opening the panel to ensure fresh state.
