# Spec: Round notes

Status: ready-for-agent

## Problem Statement

A quiz master introduces each round out loud: what it's about, a rule twist, a joke, who wrote it. Today there is nowhere to write that down. Questions have host-only notes on `/remote`, but a round title card has nothing, so while the round intro is on air the Notes panel says "No notes for this question." Sometimes the quiz master also wants the room to read the intro text (e.g. "Answers must be in English"), and there is no way to put it on the big screen.

## Solution

A round gets a **Round note** (glossary already updated): what the quiz master says while that round's intro is on air. It always appears on `/remote` while the round intro or the break round intro is on air. When the round's "show on screen" setting is on, it also appears on the big screen on those cards. It never appears on the reveal intro or on phones. A question's notes stay host-only and never appear on screen.

## User Stories

1. As a quiz author, I want to write a note on a round in the quiz editor, so that I have my intro patter ready on the night.
2. As a quiz master, I want `/remote`'s Notes panel to show the round note while that round's intro is on air, so that I can read from it while I introduce the round.
3. As a quiz master, I want the same note on `/remote` when break review steps back across the round intro, so that I can repeat it if needed.
4. As a quiz master, I want the Notes panel to say "No note for this round." on a round intro without one, so that I know there's nothing to miss.
5. As a quiz author, I want a "show on screen" checkbox on the round, off by default, so that I can choose to put the note on the big screen as well.
6. As an audience member, I want to read the round note under the round title, category and author on the big screen when the quiz master has shown it, so that I see rules or context for the round.
7. As a quiz author, I want the checkbox greyed out while the note is empty, so that I can't turn on something that shows nothing.
8. As a quiz master, I want to fix a round note or its checkbox while the quiz is running (any round, even one already played), and see `/remote` and the big screen update if that card is on air, so that I can correct a typo live.
9. As a quiz author, I want `round_note` and `show_round_note` CSV columns, so that I can write notes in my sheet.
10. As a quiz author, I want Export CSV to write both columns, so that an exported quiz imports again unchanged.
11. As a quiz author, I want the sample import CSV to show both columns, so that I can see how to use them.
12. As a quiz master, I want the `/guide` page to explain round notes, so that I know they exist and where they appear.

## Implementation Decisions

- **Data.** `Round` gets `note` (`text`, nullable) and `showNoteOnScreen` (`boolean`, default `false`), plus a MikroORM migration (prior art: `Migration20260924120000_AddCategoryAndAuthorToRounds`). Existing rounds have no note and the setting off.
- **Format.** Plain text with line breaks kept, trimmed, at most 500 characters (a named constant in shared types), validated at the request boundary (`quiz-draft.schema.ts`) and at CSV import. A blank note is stored as null. Rendered as text (`whitespace-pre-line`), never as HTML.
- **Draft shape.** `QuizDraft` rounds gain optional `note` and `showNoteOnScreen`, and `findDraftById` and the save path copy them the same way they copy `category` and `author`.
- **Seeding.** `SeededRound` gains the note and the setting (seeded in `seed.service.ts` with `category` and `author`). Live edits re-seed sessions through the Live edit module, so a saved fix reaches running sessions with no extra path.
- **Host-only by default.** The note lives on the server's seeded round. Like `questionNotesById`, it must never go into a broadcast view on its own. The display view gets the note only for the round title card on air, and only when `showNoteOnScreen` is on and the note is non-empty. The players view never gets it. A projection test guards this.
- **Where it shows.** It shows on the round intro, and on the break round intro when break review steps across it. It never shows on the reveal intro. This is decided once, in the server projection, from the on-air screen (`on-air-screen.ts`), not on each screen.
- **/remote.** `PresenterContextPayload` gains the round note for the round title card on air (`currentRoundNote: string | null`), separate from `currentQuestionNotes`. The Notes panel shows the question notes when a question is open, the round note on a round intro or break round intro, and "No note for this round." when that round has none. The "next" preview is unchanged.
- **Big screen.** `round-title-card.tsx` draws the note under the title, category and author when the display view carries it. It follows the display text scale.
- **Editor.** In `quiz-round-editor.tsx`, a textarea ("Round note — what you say before this round") with a character count, and a "Show on screen" checkbox, disabled while the note is blank. Both can be edited for every round, even live: they're not structure, so `findLiveEditViolations` ignores them.
- **CSV.** Two new optional columns at the end: `round_note` and `show_round_note` (`''`/`0`/`1`). Both are round-level, like `category` and `author`: the first non-blank cell seen for a round wins. A note over the limit is reported as invalid on its `round_note` cell. `show_round_note=1` with an empty note is accepted and has no effect. Sheets without the columns still import. Export (`quiz-csv-export.ts`) writes both on a round's last row, with `show_round_note` blank when it's off. `apps/frontend/public/sample-quiz-import.csv` gains both columns, with a note on at least one round and one shown on screen.
- **Docs, in the same commit as the code that changes them:** DOCUMENTATION.md (the round intro, the presenter context and `PRESENTER_CONTEXT_UPDATED`, the sheet row format and its round-level cells paragraph, the export mechanics) and the `/guide` page (the editor and `/remote`). GLOSSARY.md is already updated (**Round note**).
- **No ADR.** It's easy to reverse and follows the existing round metadata.

## Testing Decisions

- **What makes a good test:** it drives a public interface (the projections, the presenter context, the codecs, the rendered screens, the editor panel) and asserts what a caller sees.
- **Seam 1: backend projection and presenter context.** On the round intro: a round with a note and the setting off gives `currentRoundNote` on the presenter context, but no note in the display or players view. With the setting on, the display view carries it and the players view still doesn't. On the reveal intro neither view carries it, and the presenter context doesn't either. On an open question, `currentRoundNote` is null. Break review across the round intro behaves like the round intro. Prior art: `presenter-context.spec.ts`, `admin-flags-projection.spec.ts`, `single-room-fields.spec.ts`.
- **Seam 2: save and live edit.** The draft round-trips the note and setting, a note over 500 characters is a `400`, and saving a note fix on a played or current round while live is accepted and reaches the session. Prior art: `live-edit.spec.ts`, the quiz service specs.
- **Seam 3: CSV.** Round-level resolution (first non-blank wins), the over-limit issue, the empty note with the setting on, a sheet without the columns, and an export → import round trip. Prior art: `question-csv-round-trip.test.ts`, the sheet parser specs.
- **Seam 4: frontend.** `/remote`'s Notes panel on a round intro, with and without a note. `/display`'s round title card with and without the note. The editor's checkbox is disabled while the note is blank. Prior art: `rules-and-round-intro.test.tsx`, the `/remote` tests, `quiz-editor-panel.test.tsx`.

## Out of Scope

- A note on the reveal intro (that would be a second field later).
- Showing the round note in `/remote`'s "next" preview.
- Showing it on phones.
- Markdown or other formatting.
- Notes on `/control`.
