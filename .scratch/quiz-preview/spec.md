# Spec: Quiz preview — step through a quiz's big-screen screens without a session

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-10-20 (`/grill-with-docs`). **Quiz preview** is defined in `GLOSSARY.md`.

## Problem Statement

A quiz master who wants to check a quiz for mistakes before the night has only one way to see it as the big screen will: create a real session and play it through. That session is a real game:

- It shows up in the public session list, so the venue `/display` picker offers it and teams could join it.
- It can't be closed halfway. Closing is refused until the session has `ended`, so the quiz master has to step through every question, break and reveal to get rid of it.
- Once ended, it counts everywhere: it is listed on `/stats`, adds to sessions played, appears on team pages and can count towards a league. The quiz master has to remember to delete it from `/stats` afterwards.

So checking for typos, wrong answers, broken clips or text that overflows the screen costs a full play-through and a clean-up, and a forgotten clean-up pollutes the stats.

## Solution

A **Quiz preview** is a staff-only page that shows a saved quiz's display screens, drawn by the same components as `/display`, inside a 16:9 frame on the laptop. The quiz master steps through it with Prev/Next or the arrow keys, or jumps from a side list. No session is created. Nothing is played, stored or counted, and no team can join.

It has two orders:

- **Question → answer** (the default): each round's title card, then each question followed straight away by its revealed answer, with a "block ends here" marker after each block's last question.
- **Like the night**: the screens in the order a night shows them. Round overview, round title cards, a block's questions, the break intro, the reveal intro, then that block's reveals.

Host-only text (question notes, and round notes that aren't shown on the big screen) appears in a labelled side panel next to the frame. A fullscreen toggle shows the frame alone at full size. Media plays exactly as it would on the night.

It opens from the quiz editor (a Preview button, and "Preview from here" on each question), from each quiz in the quiz list, and from a lobby session on `/sessions`. Test sessions stay possible for rehearsing the flow or testing phones. The `/guide` page points moderators to the quiz preview for checking content.

## User Stories

1. As a quiz master, I want to see a quiz's screens exactly as the big screen will draw them, so that I can catch mistakes before the night.
2. As a quiz master, I want previewing to create no session, so that nothing ends up in stats, sessions played, team pages or leagues.
3. As a quiz master, I want a preview never to appear in the `/display` session picker or the public session list, so that no team can join it and no big screen can pick it.
4. As a quiz master, I want to stop previewing at any point by closing the page, so that I never have to step through to the end or clean anything up.
5. As a moderator, I want to preview any quiz just as an admin can, so that whoever runs the night can check it.
6. As a logged-out visitor, I want to be refused a quiz preview, so that nobody can read a quiz's answers before the night.
7. As a quiz master, I want the preview to show the saved quiz, so that what I check is exactly what a session will play.
8. As a quiz master, I want a warning when I open the preview from the editor with unsaved changes, so that I don't check an outdated version by mistake.
9. As a quiz master, I want each question followed straight away by its revealed answer by default, so that I can compare a question with its answer at a glance.
10. As a quiz master, I want a "block ends here" marker after each block's last question, so that I can check where the breaks fall.
11. As a quiz master, I want to switch to the "like the night" order, so that I can see the screens in the order the room will.
12. As a quiz master, I want the "like the night" order to show the round overview, round title cards, questions, break intro, reveal intro and reveals in the order a real session goes through them, so that the preview never disagrees with the night.
13. As a quiz master, I want kahoot rounds to show each question's reveal right after it in both orders, as on the night, so that kahoot rounds look as they will.
14. As a quiz master, I want each round's title card to show its title, category, author, and its note when the round is set to show it on screen, so that I can check them.
15. As a quiz master, I want every question type to be drawn by the same component the big screen uses, including options, match targets and media, so that layout problems show up in the preview.
16. As a quiz master, I want each reveal to show the correct answer laid out as the big screen does, so that I can check the answer key.
17. As a quiz master, I want a closest_guess question's reveal to show just its correct answer, so that I can check it without any team guesses.
18. As a quiz master, I want the preview drawn in a letterboxed 16:9 frame, so that text wraps as it will on the TV.
19. As a quiz master, I want a fullscreen toggle, so that I can judge the screens at full size.
20. As a quiz master, I want video clips to play within their start and end bounds with sound, so that I can check the clip bounds.
21. As a quiz master, I want YouTube clips to play as they will on the night, so that I can check they load and start at the right point.
22. As a quiz master, I want questions set to hide their video to hide it in the preview too, so that I hear what the room will hear.
23. As a quiz master, I want images to load in the preview, so that I can catch broken or wrong images.
24. As a quiz master, I want live-only parts of the screen (team counts, roster, fun facts, guesses) left out, so that the preview shows no made-up data.
25. As a quiz master, I want a slot whose size affects the layout, such as the countdown, to show a static placeholder, so that the layout matches the night.
26. As a quiz master, I want lobby, rules, join overlay, locking countdown, break review, leaderboard, showdown and ended screens left out, so that the preview shows only screens with quiz content.
27. As a quiz master, I want question notes, and round notes not shown on screen, in a side panel labelled "host only", so that I can check the text the room never sees.
28. As a quiz master, I want the host-only panel hidden in fullscreen, so that the frame shows exactly what the TV will.
29. As a quiz master, I want to step forward and back with Prev/Next buttons and the arrow keys, so that I can move through the quiz quickly.
30. As a quiz master, I want a side list of rounds and questions to jump to, so that I can go straight to the part I'm checking.
31. As a quiz master, I want the order and my position kept in the URL, so that a refresh or a shared link opens the same screen.
32. As a quiz master, I want a Preview button in the quiz editor, so that I can check my edits right after saving.
33. As a quiz master, I want "Preview from here" on each question in the editor, so that the preview opens at the question I'm working on.
34. As a quiz master, I want a Preview action on each quiz in the quiz list, so that I can check a quiz without opening the editor.
35. As a quiz master, I want a Preview action on a session waiting in the lobby on `/sessions`, so that I can do a last check of its quiz before pressing Start quiz.
36. As a quiz master, I want an empty quiz, or a round with no questions, to preview without errors, so that I can preview a quiz while I'm still writing it.
37. As a quiz master, I want an unknown or deleted quiz's preview to say so, so that a stale link doesn't show a blank page.
38. As a quiz master, I want test sessions to stay possible, so that I can still rehearse the flow or test the phones.
39. As a moderator, I want the `/guide` page to point me to the quiz preview for checking content, so that I stop creating throwaway sessions.

## Implementation Decisions

- **No session, no stored state.** A quiz preview never creates a `game_sessions` row, never enters the Session write module's in-memory sessions, joins no socket room and writes nothing. It is a read of the quiz.
- **Loading a quiz without a session.** Loading a quiz's seeded rounds and settings currently needs a session row. Split out a session-free load of a quiz's seeded rounds (the same Question record conversion as a session's seeded game), which session loading then reuses. That way a preview and a session can't hold the quiz differently.
- **The Quiz preview module (new, pure, in `shared/types`).** It takes the seeded rounds and a mode (`answer_after_question` | `night`) and returns the ordered preview steps. Each step carries:
  - its `DisplayScreen`
  - its position (round and question indexes, for the jump list and the URL)
  - whether a block ends after it
  - its host-only text: the question's notes, and the round note when the round doesn't show it on screen

  The module builds a team-less, in-memory `SessionState` from the seeded rounds and gets every screen through the existing display projection (`projectScreen` for the display room and `describeDisplayScreen`). It never builds a `DisplayScreen` by hand, so the preview can't drift from what `/display` draws.

- **Night order comes from the real Advance plan.** The `night` mode walks the session the way presses would, as a dry run (no grading writes, nothing saved), the way the presenter preview already describes the next press. It keeps only the screen kinds the preview shows. The `answer_after_question` mode reorders the same screens: round title card, then each question followed by its reveal, with the block-end marker.
- **Screen kinds shown:**
  - `night` mode: `round_overview`, `round_title`, `question`, `break_intro`, `reveal_intro` and `reveal`.
  - `answer_after_question` mode: `round_title`, `question` and `reveal`.
  - Never shown: `lobby`, `rules`, `join_overlay`, `locking`, `break_review`, `break_round_title`, `leaderboard`, `showdown`, `ended` and `blank`.
- **Live-only content is empty.** Because the session has no teams, the screens carry no team counts, guesses, roster or leaderboard. Fun facts are off. `break_intro` has no `breakEndsAt` and no feedback prompt. A closest_guess reveal is at its single "nobody guessed" step, so it shows the correct answer.
- **Endpoint.** `GET /quizzes/:id/preview?mode=…` returns the preview steps for the saved quiz. It sits behind the same session and role guards as the other quiz reads, so admins and moderators can use it, and it has no admin-only restriction. An unknown quiz is a 404, and an invalid mode is a 400 (boundary validation with Zod, as for other query params). The payload type lives in `shared/types`.
- **Page.** A new staff page `/quizzes/[id]/preview`:
  - It draws each step's `DisplayScreen` with the existing `/display` screen components, unchanged, inside a letterboxed 16:9 frame. If those components are currently chosen inside `/display`'s page, pull the kind → component switch out so both pages share it.
  - Next to the frame: a jump list, Prev/Next buttons with arrow keys, a mode toggle and the host-only panel.
  - A fullscreen toggle shows the frame alone.
  - URL state: `?mode=night` (default omitted) and `?at=` naming the position, read on load and kept up to date while stepping.
  - It is laptop-only, so it isn't designed for phone width beyond not breaking.
- **Entry points:**
  - The quiz editor's Preview button. When the draft has unsaved changes, the editor's existing dirty-state tracking prompts before opening it.
  - "Preview from here" on each question, which opens the preview at that question.
  - A Preview action on each quiz list row.
  - A Preview action on lobby sessions on `/sessions`, which opens the session's quiz.
- **Media** uses the display's existing media components, so clip bounds, YouTube and `hideVideo` behave as on the night.
- **Docs, in the same change:** `DOCUMENTATION.md` (the new endpoint and the route table row) and the `/guide` page (check a quiz with Quiz preview rather than a throwaway session). `GLOSSARY.md` already has **Quiz preview**.

## Testing Decisions

- Tests check external behaviour only: the steps the module returns, what the endpoint answers and writes, and what the page draws and how it responds to input. They don't check how the module walks the session internally.
- **Quiz preview module (main seam).** Pure tests built from the existing game-state fixtures. Prior art: `shared/types` tests such as `fun-facts.test.ts` and `game-state-forward-transitions.test.ts`. They cover:
  - both orders over a multi-block quiz
  - block-end markers
  - a kahoot round
  - each screen kind that should be left out
  - a round note shown or not shown on screen, and the host-only text
  - closest_guess showing only its answer
  - `hideVideo` and clip bounds carried through
  - live-only fields empty
  - an empty quiz and an empty round
  - `night` order matching the screens a real session reaches by Advance
- **Endpoint (thin seam).** A backend spec over the test database, in the style of the quiz controller spec. It covers:
  - admin and moderator allowed, and logged-out refused
  - 404 for an unknown quiz and 400 for a bad mode
  - the steps reflect the saved quiz
  - no `game_sessions` row (or any other row) is written, and no in-memory session is added
- **Page (frontend seam).** Vitest tests in the style of `apps/frontend/app/display/__tests__`. They cover:
  - each step drawn by the display components
  - Prev/Next and arrow keys
  - the jump list
  - `?mode=` and `?at=` read and written
  - the host-only panel shown, and hidden in fullscreen
  - the not-found state

  The editor's unsaved-changes prompt goes in the editor's existing tests.

## Out of Scope

- Showing a preview on the big screen or any device that isn't logged in. There is no share link, and `/display` is unchanged.
- Previewing an unsaved editor draft.
- How questions look on phones (`/play`), and rehearsing a night's flow: timers, locking, grading, leaderboard, showdown. A test session still covers those.
- Sample or fake team data in the preview.
- Blocking or flagging test sessions, or automatically keeping them out of stats.

## Further Notes

- The **presenter preview** (the "next" line on `/remote`) is a different thing. It describes the next press in a live session. The glossary entry for **Quiz preview** says so.
- No ADR: every decision here is easy to reverse.
