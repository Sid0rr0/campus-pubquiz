# Spec: The server sends the leaderboard's "before" board

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-14, candidate 3 ("The server sends the leaderboard's 'before' board", "Strong", in-process).

## Problem Statement

The big screen's leaderboard needs to know the standings as they were before the latest points landed, for two things:

- **The between-questions count-up.** In a kahoot round, the leaderboard shown between questions opens on the old board, counts each team's score up to its new total, then reorders the rows.
- **The trend arrows.** Once the board settles, each team shows whether it moved up, down or stayed level.

That "before" board exists only in the big screen's own memory. The display page watches the snapshots it receives and remembers the last leaderboard it saw while a question was on air and the board was hidden. It then decides, from the round being kahoot and from whether it is between kahoot questions, which board to animate from, which to compare trends against, and whether to cap the board at the top five. The leaderboard rows module holds three trend bases (the animated board, a separate trend baseline, and "this round's points backed out" as a last resort), plus a special case for a prior board where every team is tied.

For the people in the room:

- **A big screen that reconnects mid-kahoot loses the old board.** After a reload, a dropped Wi-Fi connection or a backend redeploy, the display's memory is empty. The next between-questions leaderboard counts every team up from 0, and the trend arrows compare against nothing or against an approximation. The project guide says the reconnect path must work, and here it doesn't.
- **Two big screens can disagree.** A screen opened partway through a kahoot round remembers a different board from one that was open from the start.

For a developer:

- **It breaks the coding standard that a client renders the view it is sent.** The display works out state the server already has.
- **The top-five cap lives twice.** The server caps the kahoot reveal walk at the top five, and the display caps what it draws at the top five, each reading the shared constant separately.
- **The trend can't be tested where it matters.** The trend rules live in a frontend module, so no backend spec can check what a team's arrow will be.

## Solution

The session keeps the standings as they stood before the latest scoring, and the display view carries one complete description of the leaderboard to draw: the entries, the board to count up from (when the board should count up), the cap, and each team's trend. The server applies the rules that decide all of this once, so every big screen draws the same thing, including one that has just reconnected. The display page stops remembering boards and stops choosing bases. The leaderboard rows module shrinks to the animation phases: hold the old board, count up, settle.

The room sees exactly what it sees today on a big screen that has been open all along. A big screen that reconnects now sees the same thing too.

## User Stories

1. As a quiz master running a kahoot round, I want the leaderboard between questions to open on the old standings, count each team up and then reorder, exactly as today, so that the room sees who gained.
2. As a quiz master, I want a big screen that reloaded mid-kahoot to count up from the real previous standings, not from 0, so that a reload doesn't spoil the moment.
3. As a quiz master, I want a big screen that lost its connection to show the same count-up as one that didn't, so that a flaky venue network doesn't change what the room sees.
4. As a quiz master, I want two big screens on the same session to always draw the same leaderboard, so that a second screen opened late isn't out of step.
5. As a quiz master, I want the first kahoot question of the quiz to count every team up from 0, as today, since there is no earlier board.
6. As a quiz master, I want a kahoot round's leaderboard capped at the top five, splitting a tie at the cutoff as today, so that the board fits the screen.
7. As a quiz master, I want the between-questions board to show its top five at once, and the round-end and quiz-end boards to reveal one rank at a time, exactly as today.
8. As a quiz master, I want the round-end and quiz-end boards of a kahoot round to show trends against the standings before the last question, as today, and not against the whole round backed out.
9. As a quiz master, I want the round-end and quiz-end boards of an ordinary round to show trends against the standings before that round, as today.
10. As a quiz master, I want every team shown moving up when everyone was tied before (for example, all on 0), as today, rather than a dash for the leader and a down arrow for everyone else.
11. As a quiz master, I want no trend arrow on a team that wasn't on the previous board, as today.
12. As a quiz master, I want trend arrows only once the board has settled, never mid-count, as today.
13. As a quiz master, I want grading or a bonus award while a question is on air to be part of the "before" board, as today, so that the count-up shows only what the latest scoring added.
14. As a quiz master, I want the reveal walk's step count and the board's cap to agree, so that the last reveal step always shows the last capped rank.
15. As a quiz master, I want the leaderboard to keep working while the join overlay or a tiebreaker is shown and hidden, exactly as today.
16. As a team, I want my phone to be unaffected, since it doesn't draw this leaderboard.
17. As a developer, I want the display to render the leaderboard it is sent, so that the coding standard holds for the leaderboard too.
18. As a developer, I want the rule for which board counts as "before" to live in one server module, so that every big screen and every test sees the same rule.
19. As a developer, I want each team's trend worked out by the server, so that a backend spec can assert the arrows.
20. As a developer, I want the top-five cap applied in one module, so that the reveal walk and the drawn board can't disagree.
21. As a developer, I want the leaderboard rows module to handle only the animation phases, so that it is small enough to read in one sitting.
22. As a developer, I want a reconnecting big screen tested through the same specs that drive a session, so that the reconnect case is pinned.
23. As a developer, I want the glossary to name the "before" board, so that the term means the same thing in code, specs and conversation.

## Implementation Decisions

- **New domain term: prior standings.** These are the standings as they stood before the latest scoring the leaderboard should show: the last standings the session had while a question was on air and the board was hidden. That is today's display-side capture rule, moved to the server unchanged. Add it to the glossary.
- **The session keeps the prior standings.** The Session write is where every change ends with fresh standings, so it updates the prior standings there. When a write starts from a session whose question is on air (question open or locking) and whose leaderboard is hidden, that session's current leaderboard becomes the prior standings, before the new standings are read. Otherwise the prior standings carry over unchanged. Before any board exists, the prior standings are every team on 0, so the first kahoot question counts up from 0 as today.
- **The prior standings are ephemeral, like the reveal counters.** They are not saved. A backend restart restores a session with no prior standings, so the first board after a restart doesn't count up and its trends fall back as the next decision describes. A display reload or reconnect, without a backend restart, now keeps them. That is the case this spec fixes.
- **The display view carries one leaderboard description,** built by the Screen projection:
  - **entries:** the current standings, already capped where a cap applies
  - **reveal count:** as today
  - **count-up board:** the prior standings to animate from, present only for the between-questions kahoot board
  - **trend per team:** `up`, `down`, `same` or absent, worked out against the trend basis below
  The display no longer receives a separate kahoot flag or "between questions" flag just to choose a leaderboard mode. It keeps whatever other screens still need.
- **The trend basis is decided on the server, in one place.** The rules come across from the leaderboard rows module unchanged:
  - the prior standings, when the round is kahoot (between questions or at round end or quiz end)
  - otherwise, the standings with the current round's points backed out
  - no trend when neither applies
  - every team `up` when the basis is real prior standings with more than one team, all tied
  - no trend for a team missing from the basis
  Ranks are compared with the shared ranking rule, as today.
- **The cap is applied once.** The kahoot top-five cap (first five by final standing, splitting a tie at the cutoff) is applied by the same shared module that gives the reveal walk its step count. The description's entries are already capped. The display stops reading the top-five constant.
- **The leaderboard rows module keeps only the animation.** Given the description and the current phase, it draws the old board, counts up, then settles. It reveals bottom-up by the reveal count and shows the sent trends only once settled. The display-side capture, the three trend bases, the round-backed-out approximation and the all-tied special case leave it.
- **The display page stops remembering boards.** Its remembered-board state and the capture call go, and it passes the description straight to the leaderboard component.
- **Other views are unchanged.** The players and admin views don't carry the description. The control panel's own leaderboard preview, if it uses the shared component, renders settled entries with no trend, as today.
- **No database change and no compatibility shim.** Both apps deploy together. Update the socket event schema for the display view.
- **Docs to update in the same change:**
  - GLOSSARY.md (prior standings)
  - DOCUMENTATION.md, where it lists the display view fields and describes the kahoot leaderboard
  - docs/architecture.md, if its leaderboard flow shows the display remembering a board
  `/guide` doesn't change, because nothing the moderator sees or does changes.

## Testing Decisions

- **A good test asserts what the big screen is sent and what the leaderboard draws, not how either was worked out.** Assert the leaderboard description on the display view, and the rows a component renders for a given description and phase. Don't assert which helper picked the basis.
- **Seam 1: the display view, through the existing backend real-store specs.** These already drive kahoot rounds, grading and the leaderboard toggle. Extend them to assert:
  - between kahoot questions, the count-up board equals the standings before the last question's points landed, and the entries are capped at the top five
  - the first kahoot question's count-up board is every team on 0
  - a big screen that joins or resyncs mid-board receives exactly the same description as one connected throughout
  - grading or a bonus award while the question is on air is part of the count-up board
  - round-end and quiz-end boards of a kahoot round carry no count-up board, keep the one-rank-at-a-time reveal and the cap, and give trends against the prior standings
  - an ordinary round's round-end board gives trends against the round backed out
  - an all-tied prior board gives every team `up`
  - a team missing from the basis has no trend
  - after a simulated restart, the first board has no count-up board
  - the reveal walk's step count matches the capped entries
  Prior art: the kahoot leaderboard answer-gate spec, the advance-under-leaderboard spec, the leaderboard spec, the screen projection spec and the session snapshot leak spec.
- **Seam 2: the Leaderboard component, rendered from description fixtures in the existing Vitest suites.** Assert:
  - a description with a count-up board draws the old board, counts up, then settles in the new order
  - one without a count-up board draws settled rows straight away
  - the reveal count reveals bottom-up
  - trends appear only once settled, exactly as sent
  Prior art: the leaderboard component test, the leaderboard rows test and the display's completion-and-leaderboard test.
- **Deleted tests.** The test of the display-side capture rule goes with the capture rule. Its cases move into Seam 1's prior standings assertions. The leaderboard rows test's trend-basis cases move to Seam 1 as well.
- **Type-level coverage.** The description replaces the separate kahoot and between-questions props, so a stale caller fails typecheck.

## Out of Scope

- **Saving prior standings across a backend restart.** They stay ephemeral, like the reveal counters. Rebuilding them from the database is possible later.
- **The stats page's totals** (candidate 6).
- **Changing what the leaderboard shows:** no new animation, cap or trend rule.
- **The phones' leaderboard screen.** It doesn't draw count-up or trends.
- **The control panel's reveal-button gating.** It already follows the server's Advance slot.

## Further Notes

- This is the only candidate of the 2026-10-14 review with a user-visible fix: the count-up from 0 after a display reconnect mid-kahoot. Write the reconnect assertion in Seam 1 first, and watch it fail against today's view (which carries no prior board) before moving the rule.
- The prior standings rule is the display's capture rule moved to the server unchanged. A change to when points land (for example, speed scoring moving off the lock) is now a server change with a backend test, not a display change.
- Respects the coding standards rule that the leaderboard is a flag, not a status. The prior standings key off that flag the same way the display capture did.
