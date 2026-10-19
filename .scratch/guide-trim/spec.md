# Spec: A shorter moderator guide

Status: ready-for-agent

Blocked by: none

Source: request 2026-10-19 ("the /guide page docs are too long and verbose").

## Problem Statement

The `/guide` page (`apps/frontend/app/guide/guide-content.tsx`) is about 3,200 words across 15 sections, with single paragraphs of up to ~900 characters. A moderator skimming it before or during a night can't find the one thing they need quickly. Much of it explains *why* or restates detail that belongs in `DOCUMENTATION.md` (e.g. the full CSV column list).

## Solution

Rewrite each section as the shortest text that lets a moderator do the task: short steps or bullets, one idea per line, no rationale. Keep the task-based section structure from [`moderator-guide`](../moderator-guide/issues/01-task-based-guide-from-shared-sources.md) and its rendering from shared sources (`QUESTION_KINDS`, `ADMIN_SHORTCUTS`).

## Implementation Decisions

- **Target:** roughly a third of today's length (about 1,000–1,200 words, the registry- and shortcut-rendered bullets included). No paragraph over ~300 characters.
- **Cut, don't move to a new page:** reasoning, edge cases the moderator can't act on, and anything the screen already says next to its button.
- **CSV authoring detail:** the column-by-column reference shrinks to the columns a moderator edits by hand plus a link to the downloadable template; the full reference stays in `DOCUMENTATION.md`.
- **Merge thin sections** where one task covers both (e.g. pausing and replaying media under running questions); the section list may shrink.
- **Facts that must survive** are the ones pinned by `__tests__/guide-content.test.tsx`: every question type, every shortcut, player count and over-cap flag, the Collect feedback switch, the number-question margin, Hide video and `hideVideo`, grading before the break and finishing in it, no raw status names. A test may be reworded only to match new wording, never to drop a fact.
- **Glossary language** stays: block, break, break review, round title card, question type.

## Out of Scope

- `DOCUMENTATION.md`, `GLOSSARY.md` and the README.
- The page's layout or styling.
