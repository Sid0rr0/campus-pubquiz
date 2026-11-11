# Early answer reveal

Status: ready-for-agent

## Problem Statement

At a paper pub quiz the quiz master reads out the answers as soon as a round ends, while the sheets are being marked, and announces the scores after the break. Our pub quiz flow can't do that: a block's correct answers stay hidden through the whole break and only air afterwards, in the reveal, together with the verdicts. Some quiz masters want the room to hear the answers while the round is fresh. The break is then for marking and chatting, and the scores come back after it.

## Solution

A new pub quiz session setting, **Early answer reveal** (shown on `/control` as "Show correct answers before break"). With it on, every block runs:

lock → `answers_intro` → `answers` (one question at a time, correct answer on the big screen, no verdicts) → break (grading, as today) → the next block's `round_intro` (or `ended` after the last block) with the leaderboard up.

The usual post-break reveal (`reveal_intro` → `reveal`) doesn't run, because the answers have already aired. While the leaderboard is up after the break, phones show the team's verdicts. Teams see their own answers beside the correct ones during the early answer reveal, but no verdicts or points until grading is done. With the setting off, nothing changes.

See `GLOSSARY.md` (**Early answer reveal**, **Break review**, Game status) and ADR 0006.

## User Stories

1. As a quiz master, I want a "Show correct answers before break" switch in the session start dialog, so that I can choose the paper-quiz rhythm for a night.
2. As a quiz master, I want the same switch in the `/control` lobby settings panel, so that I can change my mind before the quiz starts.
3. As a quiz master, I want the switch locked once the quiz has started, like every other setting, so that a block can't change flow halfway through.
4. As a quiz master running a quickfire quiz, I don't want to see the switch at all, so that I'm not offered something meaningless (quickfire already reveals every question as it locks).
5. As a quiz master, I want the setting off by default, so that existing nights run exactly as before.
6. As a quiz master, I want the setting to work alongside Versus, jokers, power-ups, coins, leagues, feedback and fun facts, so that I don't have to give up anything to use it.
7. As a quiz master, I want Advance on the block's last question to lock the block and go straight to an "ANSWERS · ROUND N" title card, so that the room knows answers are coming.
8. As a quiz master, I want each Advance through the early answer reveal to show the next question with its correct answer, crossing round boundaries via the answers title card, so that I can read out the answers at my own pace.
9. As a quiz master, I want the last question of the early answer reveal to advance into the break card, so that grading time begins after the answers.
10. As a quiz master, I want the break timer to start at the break card, as today, so that the room gets the full break after the answers.
11. As a quiz master, I want leaving the break still refused while any answer is ungraded, so that the scores the room sees can be trusted.
12. As a quiz master, I want Advance out of the break to go to the next block's round intro with the leaderboard already up, so that the scores come straight after grading.
13. As a quiz master, I want Advance under that leaderboard to reveal ranks one by one, then hide the leaderboard and uncover the next round intro, so that the results get their moment before the next round.
14. As a quiz master, I want Advance out of the last block's break to go straight to the final screen, so that the podium serves as the final standings.
15. As a quiz master, I want the leaderboard to open on every Advance out of a break, even when I've stepped back into the break and out again, so that the flow is predictable.
16. As a quiz master, I don't want Previous back onto a round intro to open the leaderboard, so that stepping back stays quiet.
17. As a quiz master, I want Previous from the break card to walk back through the early answer reveal with the answers showing, so that I can put a question and its answer back on screen during the break.
18. As a quiz master, I want Previous from the next block's round intro to go back to the previous block's break card, keeping every grade, so that I can undo an Advance without regrading.
19. As a quiz master, I want Previous from a block's first answers title card to go to the previous block's break card, so that a locked block never reopens and the walk stays symmetric.
20. As a quiz master, I want `/remote`'s "next" line to describe the early answer reveal steps and the leaderboard opening, so that I always know what my next press will do.
21. As a quiz master, I want the presenter remote to show the round note on the answers title card and the question notes on each answers question, as on the reveal, so that I have my script at hand.
22. As a quiz master, I want a live answer-key fix during the early answer reveal to behave as it does during the reveal, so that I can correct a mistake while the room is watching.
23. As a quiz master, I want to grade answers during the early answer reveal as well as in the break, so that I can start marking as soon as the block locks.
24. As someone in the room, I want the big screen during the early answer reveal to show the question, its correct answer, its answer media and reveal clip, so that I learn the answer the same way as in the reveal.
25. As someone in the room, I want question notes on the big screen during the early answer reveal when the question is set to show them, so that I get the story behind the answer.
26. As someone in the room, I want the power-up use counts shown with each early-revealed question, as in the reveal, so that the fun of who-bought-what survives.
27. As someone in the room, I want a closest-guess question's full step-by-step reveal (lowest guess, highest guess, answer, closest teams) during the early answer reveal, since it's graded at the lock.
28. As someone in the room, I don't want correct-rate figures during the early answer reveal, so that half-graded numbers never reach the screen.
29. As a team, I want my phone during the early answer reveal to show my own answer next to the correct answer, so that I can mark myself in my head.
30. As a team, I don't want verdict colours or points on my phone during the early answer reveal, so that a half-graded block doesn't look final.
31. As a team, I want my phone to show my verdicts, correct answers and points while the leaderboard is up after the break, so that I can read my marks while the ranks are revealed.
32. As a team, I want the read-only block browser during the break as today, so that I can look back at my answers.
33. As a team, I want "Follow the screen" to track the early answer reveal like it tracks the reveal, so that my phone stays in step with the room.
34. As a team playing a joker round, I want the joker badge on the answers title card, as on the reveal title card, so that I know which round counts double.
35. As a quiz master, I want fun facts in this break to leave out the block in play, so that no fact leaks results before grading.
36. As a quiz master, I want the leaderboard trends and count-up after the break to measure this block, so that movement on the board makes sense.
37. As a quiz master, I want the Versus side bar on the post-break leaderboard as on any leaderboard, so that Versus nights keep their tension.
38. As a quiz master, I want a backend restart while the post-break leaderboard is up to bring the leaderboard back (with its ranks to reveal again), so that a redeploy doesn't skip the scores.
39. As a moderator learning the app, I want the `/guide` page to explain the setting and its flow, so that I know what Advance does on a night that uses it.
40. As a quiz author, I want the Quiz preview to keep running the usual flow (setting off), so that preview behaviour doesn't change.

## Implementation Decisions

- **Setting:** a new boolean on the session settings (e.g. `earlyAnswerRevealEnabled`), default `false`, validated by the partial-settings Zod schema, editable in the lobby only. A stored settings JSON without the field reads as off, so no migration is needed. A quickfire quiz's session refuses it (400 on `POST /sessions` and on the settings `PATCH`), like Versus and power-ups. The start dialog and the `/control` lobby settings panel show it for pub quizzes only.
- **New statuses** `answers_intro` and `answers` (ADR 0006). They belong to the **revealing** group and not to **graded**, nor to **answering** or **break**. The status groups stay fixed and do not depend on any setting.
- **Move plan / transitions** (shared types, forward and backward transition modules), with the setting on:
  - Leaving `locking`: → `answers_intro` of the block's first round (instead of `break_intro`). The block locks exactly as today (closest_guess batch-graded at the lock).
  - `answers_intro` → `answers` on that round's first question. `answers` → the next question; at a round boundary → `answers_intro`; after the block's last question → `break_intro`.
  - Leaving the break (from `break_intro`, or the last `break` question if one is ever reached) → the next block's `round_intro` with `isLeaderboardVisible: true` and the rank-reveal count reset; after the last block → `ended`. The ungraded refusal is unchanged.
  - Previous: `break_intro` → the block's last `answers` question (break review isn't used). Walking back through `answers`/`answers_intro` mirrors the forward walk. From the block's first `answers_intro` → the previous block's `break_intro` (the first block's → wherever Previous from that block's first `round_intro` goes today, i.e. before the block). From a `round_intro` whose previous block ran with the setting → that block's `break_intro`, leaderboard hidden.
  - The leaderboard opens only on the forward move out of a break, never on Previous.
  - Existing leaderboard handling then applies unchanged: Advance under it reveals ranks, then hides it.
- **Settle step:** `answers_intro`/`answers` behave like `reveal_intro`/`reveal` for timers, deadlines and the stepped reveal (the closest-guess walk plays on `answers`). The break timer starts at `break_intro`.
- **Prior standings:** unchanged rule. They are taken when the next block's first question opens, so the post-break leaderboard counts up from the block's own prior standings.
- **Screen projection:**
  - Display: `answers_intro` draws the round title card ("ANSWERS · ROUND N"); `answers` draws what `reveal` draws (answer, answer media, reveal clip, notes when shown, power-up use counts, closest-guess steps) minus anything derived from grading (the correct-rate figures).
  - Players: the `block` phone screen gains a mode (e.g. `answers`) that shows the team's answer and the correct answer with no verdict or points. While the leaderboard is up on a `round_intro` that follows a break, the phone screen is the block browser of the block just graded, in `revealing` mode with verdicts, instead of the leaderboard. `answers_intro` shows "Look at the screen" with the round title and joker badge, like `reveal_intro`.
  - Admin/remote: notes and round notes as on the reveal; the "next" line and Move plan description cover the new steps.
- **Fun facts:** the source rule becomes "blocks whose results are out". With the setting on, the block in its break is excluded. With it off, behaviour is unchanged.
- **Grading:** not tied to a status, as today; grading during `answers` is allowed. Live answer-key fixes during `answers` follow the existing reveal rules.
- **Quiz preview:** always runs with the setting off.
- **Docs in the same change:** `DOCUMENTATION.md` (status table, settings section, display/players view fields), the `/guide` page, and `GLOSSARY.md`, which has already been updated with the term, the break review amendment and the status diagram.

## Testing Decisions

- Test external behaviour only: given a session state and an action, assert the planned step, the resulting status/progress and the projected views. Don't assert on internal helpers.
- **Primary seam, shared types (pure):** the Move plan (`planMove`/`planNextPress` and the forward/backward transitions) and the Screen projection. These cover the full walk with the setting on and off, every Previous rule above, the leaderboard opening only on forward exit from the break, the last block going to `ended`, status group membership of the new statuses, display content during `answers` (no correct-rate figures), phone screens (no verdicts during `answers`, verdicts under the post-break leaderboard) and the fun-fact exclusion. Prior art: the existing move-plan, forward/backward transition, game-state-groups, screen-projection and fun-facts tests.
- **Settings:** schema default and refusal for quickfire, plus the lobby-only change in the backend. Prior art: the session-settings tests and the Jokers/Versus settings specs.
- **Commit a move (backend, DB-backed):** leaving the break is refused while an answer is ungraded, and a committed exit from the break saves the progress with the leaderboard visible (so it survives a restore). Prior art: the existing commit-a-move and block-grading specs.
- **E2E:** one Playwright journey of a two-block pub quiz with the setting on, from lobby to `ended`, checking the big screen and a phone at the answers, break, post-break leaderboard and final steps. Prior art: the existing `e2e/` journeys.

## Out of Scope

- A Quiz preview toggle for the setting.
- Per-round or per-block choice of early answer reveal (it is per session).
- Changing the setting after the quiz has started.
- Quickfire quizzes.
- Showing verdicts on phones before grading is finished, even for auto-graded types.
- A separate results walk after the break.

## Further Notes

- Q19 of the grilling (Previous from a block's first `answers_intro`) was taken at its recommended answer: it goes to the previous block's `break_intro`.
- A backend restart while the post-break leaderboard is up restores it visible (visibility is saved progress), but its rank reveals start over because the reveal count is ephemeral.
