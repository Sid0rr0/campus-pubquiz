# Control: question detail column and on-air cards

Status: ready-for-agent

## Problem Statement

On `/control`, the quiz master only sees the big screen's content when a question is on air. When a round title card or a break is on air, the console shows nothing about it: the round's category, author and Round note aren't shown with the card, and the break number isn't shown at all. The Round note sits beside every round in the question browser, so it is clutter for most of the night and easy to miss when it matters. The question detail (round line, prompt, correct answer) sits in the grading panel, which lacks the question's options. The phase timer takes up space beside the browser rather than sitting with the other quiz master controls.

## Solution

The `/control` main area becomes two columns: the question browser on the left and a detail column on the right, with the grading list full width below them. The detail column shows whatever the big screen shows: a question (round line, prompt, correct answer and options), a round title card (kind, round number and title, category, author, Round note) or a break card ("Break N", "(final)" on the final break). Clicking a question number, a title card marker (T) or a break marker (B) in the browser shows that item in the detail column instead. When the big screen reaches the clicked item, the column follows the big screen again. The Round note leaves the browser rows and appears only on the title card. The phase timer moves into the sidebar header next to "Quiz Master" (and into the mobile bar on mobile).

## User Stories

1. As a quiz master, I want the phase timer next to the "Quiz Master" heading in the sidebar, so that the timer sits with the controls I use to run the night.
2. As a quiz master on a phone, I want the phase timer in the mobile bar, so that I still see it when the sidebar is hidden.
3. As a quiz master, I want the question browser and the detail column side by side, so that I can see where the night is and what's on air at once.
4. As a quiz master on a narrow screen, I want the two columns to stack, so that both stay readable.
5. As a quiz master, I want the detail column to show the question on the big screen by default, so that I can read along without clicking.
6. As a quiz master, I want the detail column to show the round line (round number, round title, question number), so that I know which question I'm looking at.
7. As a quiz master, I want the detail column to show the question's prompt, so that I can read it to the room.
8. As a quiz master, I want the detail column to show the correct answer, so that I can check answers and announce it.
9. As a quiz master, I want a multiple choice question's choices listed with the correct one highlighted, so that I can see the options teams pick from.
10. As a quiz master, I want a sort question's items listed as written, so that I see what teams are ordering.
11. As a quiz master, I want a match question's left items and match targets listed, so that I see what teams are pairing.
12. As a quiz master, I want no options section for question types without options, so that the column stays clean.
13. As a quiz master, I want the question's notes still shown with the question, so that grading hints stay at hand.
14. As a quiz master, I want the detail column to show the round title card when a round intro is on air, so that I know which round I'm introducing.
15. As a quiz master, I want the title card to show the round's category and author, so that I can credit the author and name the topic.
16. As a quiz master, I want the title card to show the Round note, so that I have what to say exactly when the round intro is on air.
17. As a quiz master, I want the Round note on the reveal intro's title card too, even though the big screen never shows it there, so that I have it when introducing the answers.
18. As a quiz master, I want the title card labelled with its kind (Round intro, Reveal intro, Break review: round intro), so that I know which point of the night I'm at.
19. As a quiz master, I want the detail column to show "Break N" when a break is on air, so that I can announce which break it is.
20. As a quiz master, I want "(final)" on the final break, so that I know the next reveal ends the quiz.
21. As a quiz master, I want the Round note removed from the browser rows, so that the browser is a compact map of the night.
22. As a quiz master, I want to click any question number in the browser to see that question in the detail column, so that I can look ahead or back.
23. As a quiz master, I want to click any round's T marker to see its title card, so that I can prepare a round's introduction ahead of time.
24. As a quiz master, I want to click any break's B marker to see its break card, so that I can check which break is coming.
25. As a quiz master, I want the detail column to follow the big screen again once Advance or Previous brings the big screen onto the item I clicked, so that I'm back in sync without an extra button.
26. As a quiz master, I want the green "live on display" ring to keep marking what's on air while I look at something else, so that I don't lose track of the big screen.
27. As a quiz master, I want the selected marker (question, T or B) highlighted in the browser, so that I can see what the detail column shows.
28. As a quiz master, I want the grading list full width below the two columns, so that team names and answers have room.
29. As a quiz master, I want the grading list to belong to the question in the detail column, so that I always grade the question I'm reading.
30. As a quiz master, I want no grading list while the detail column shows a title card or break card, so that I'm never grading a question I can't see.
31. As a quiz master in the break, I want to click a question with the "not yet graded" dot to grade it, so that I can finish grading before the reveal.
32. As a quiz master, I want the detail column to keep today's fallback (the block's first question) on screens with no card (lobby, rules, round overview, joker pick, leaderboard, showdown, ended), so that those screens behave as before.
33. As a quiz master, I want the last round's B marker shown, because the last round always ends a block, so that the final break appears in the browser.
34. As a quiz master reading `/guide`, I want the guide to describe the new layout, so that I know where to find the timer, the detail column and the Round note.

## Implementation Decisions

- **Round list carries title card and break data.** `QuizSummaryRound` (from `GET /quizzes`) gains `category` and `author` (absent when the round has none), and `breakNumber` and `isFinalBreak` on block-ending rounds. The server works out the break fields with the shared `getBreakNumber` / block structure helpers `/display` uses. The last round always ends a block, so its break fields follow that rule even when the stored `breakAfter` is false. `/control` derives none of this itself. The Display screen is not sent to `/control`: a browsed card needs data for every round, and one source draws both on-air and browsed cards.
- **Break marker follows the block rule.** The browser's B marker is shown wherever the round has break fields, instead of the raw `breakAfter`, so the last round's break shows.
- **Detail selection widens from a question to an item.** The page's selection is one of: a question (by id), a round's title card (by round index) or a round's break (by round index). The on-air item comes from the existing `AdminIndicators` (`onDisplayQuestionId`, `titleCardRoundIndex`, `breakRoundIndex`). The on-air title card takes precedence over the break indicator in break review (`break_round_title` lights both). The title card kind label comes from the game status: `round_intro`/`round_overview` give Round intro, `reveal_intro` gives Reveal intro, `break_round_intro` gives Break review: round intro. A browsed (not on-air) title card has no kind label.
- **Snap-back only.** A selection is dropped when the on-air item equals it (same rule as today, extended to T and B). No "follow big screen" button.
- **Fallback unchanged.** With no selection and no on-air item, the column shows the block's first question, as today.
- **Detail column is a new component**, fed the selected item and the round list. It draws the question detail now drawn at the top of the answers panel (round line, prompt, correct answer, notes), plus the options. The answers panel keeps only the grading list (correct count and per-team rows).
- **Options display:** multiple choice lists its choices and highlights the correct one(s); sort lists its items; match lists the left items and the match targets. Types without options show no options section. Which list is shown should come from the question type registry or existing answer formatting, not a new per-type switch on the page, if the registry already exposes it.
- **Grading list visibility:** shown only when the detail column shows a question. It is full width below the two columns, above Teams.
- **Round note** is no longer drawn in the browser rows; it is drawn on the title card (both on-air and browsed).
- **Phase timer** moves from the main area into the desktop sidebar header (beside the "Quiz Master" heading) and into the mobile admin bar.
- **Docs:** the Round note entry in `GLOSSARY.md` is already updated ("on the admin console with the round's title card"). `DOCUMENTATION.md`'s Round note paragraph (which says it shows under the round in the question browser) and the `GET /quizzes` description gain the new fields. The `/guide` page describes the new layout.

## Testing Decisions

- Test external behaviour only: what the quiz master sees and what clicking does, through rendered output and accessible roles/labels. Don't assert class names or internal selection state.
- **Seam 1 (main): the `/control` page**, rendered with a mocked admin view and a mocked quiz list, as in `grading-question-browsing.test.tsx` and `question-browser-notes.test.tsx`. Cover: the detail column follows each on-air item (question, each title card kind, break, final break); clicking a question, T and B shows that item; the snap-back when the on-air item matches; the fallback on screens without a card; the options per type; no grading list on a card; the grading list for a question; the Round note absent from browser rows and present on the title card; the timer in the sidebar and in the mobile bar.
- **Seam 2: `QuizService.list()`** (prior art `quiz.service.spec.ts`): category/author present or absent; break number and final flag on block-ending rounds; the last round treated as block-ending even with `breakAfter` false.
- Update existing tests that assert the old layout (`answers-panel.test.tsx` header assertions, `question-browser-notes.test.tsx` Round note placement, `phase-timer.test.tsx` placement) rather than leaving them asserting the old behaviour.

## Out of Scope

- Cards for other on-air screens: lobby, rules, round overview, joker pick, join overlay, leaderboard, showdown, ended.
- A "follow big screen" button.
- Sending the Display screen to `/control`.
- Defaulting grading to the first ungraded question in the break.
- Changes to `/remote`, `/display` or the Quiz preview.

## Further Notes

- Today `QuizService.list()` passes the stored `breakAfter` through unchanged, while the block rule elsewhere forces the last round to end a block, so the last round's B marker can be missing today. The break fields fix this as a side effect.
- The "Round note" is the glossary term; avoid "topic note" or "title card note".
