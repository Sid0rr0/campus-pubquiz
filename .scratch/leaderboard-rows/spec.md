# Spec: Leaderboard row selection is a pure module, apart from the leaderboard view

Status: ready-for-agent

## Problem Statement

The display leaderboard decides which teams the room sees, in what order, with which rank label and which trend arrow. All of those rules live inside the animated leaderboard view, and one of them lives in the display page:

- **Cap.** A Kahoot round shows the top N by final standing, splitting a tie at the cutoff instead of growing past N.
- **Reveal walk.** The leaderboard reveal counts distinct ranks bottom-up inside the capped pool, so a tie reveals in one step and the walk always reaches rank 1.
- **Old-board pool.** Between Kahoot questions the board opens on the previous standings. The pool is chosen by final standing, newcomers start at 0, and an empty previous board means every team starts at 0.
- **Trend.** The arrow compares against the previous board, then the trend baseline, then "this round's points backed out", and forces "up" for everyone while the old board had no established order.
- **Previous-board capture.** The display page remembers the last board seen while the question was still on air and the leaderboard hidden. This is the board the Kahoot animation and the trend arrows compare against.

Because these rules are mixed with motion rows, count-up totals and phase timers, the only way to test them is to render the DOM. The leaderboard test file is about 1,200 lines of DOM queries and fake timers, and every regression fix in this area (the capped walk that never reached rank 1, the old pool picking the wrong teams, the bogus trend baseline in a Kahoot round's first reveal) was made, and is now guarded, through rendered output. A developer changing a rule has to read a 526-line view to find it. They can't see the rules side by side, and they can't add a case without writing more DOM setup.

## Solution

A new **leaderboard rows** module holds the rules as pure functions:

- **Row selection** takes the entries, the optional previous board and trend baseline, the reveal count, the cap, the current round index and the animation phase. It returns the rows to show, in order, each with its entry, rank index, rank label and trend (or none).
- **Previous-board capture** takes the board currently remembered and the latest snapshot's status, leaderboard visibility and leaderboard. It returns the board to remember next.

The leaderboard view keeps only presentation: the phase timers, the animated rows, the count-up total, the bonus stars and the trend icon. It asks row selection for its rows on every render. The display page keeps holding the remembered board in state, but asks the capture rule what to remember instead of deciding itself.

Nothing changes on screen. The leaderboard's props and the display page's wiring stay the same.

## User Stories

1. As a quiz master, I want the big-screen leaderboard to show exactly the same teams, order, labels and arrows after this change, so that a refactor never shows up live on stage.
2. As someone in the room, I want tied teams to share one rank label ("2.–4."), so that a tie reads as a tie.
3. As someone in the room, I want a Kahoot round's leaderboard to show at most the top five teams, so that the between-questions board stays readable.
4. As someone in the room, I want a tie at the Kahoot cutoff to be split instead of growing the board past five rows, so that the board never overflows.
5. As someone in the room, I want the leaderboard reveal to walk up from last place one rank at a time, so that the suspense builds toward the winner.
6. As someone in the room, I want a tie to reveal in one step, so that tied teams appear together.
7. As someone in the room, I want a capped reveal to always reach rank 1, so that the winner is never hidden below the cutoff.
8. As someone in the room, I want rank numbers to stay relative to the full standings during a reveal, so that "5." means fifth overall, not fifth of what's visible.
9. As someone in the room, I want a reveal count of zero to show no rows, and a reveal count above the number of ranks to show every row, so that the walk starts empty and ends complete.
10. As someone in the room, I want the board between Kahoot questions to open on the old standings and totals, so that I can see the scores count up.
11. As someone in the room, I want the board to count each team's total up in place before rows reorder, so that I can follow who moved.
12. As someone in the room, I want the board to settle into the new order after the count-up, so that the final standings are clear.
13. As someone in the room, I want the old board to show the same teams the board settles into, so that rows don't swap in and out mid-animation.
14. As someone in the room, I want a team new to the board to start from 0 in the old state, so that its count-up starts from nothing.
15. As someone in the room, I want the first Kahoot question's board to start every team at 0 when no earlier board exists, so that the animation still plays.
16. As someone in the room, I want the zero stand-in board capped to the eventual top teams, so that the first board also stays within five rows.
17. As someone in the room, I want an up, down or level arrow beside each team once the board settles, so that I can see who climbed.
18. As someone in the room, I want no arrows while the board is still in its old or counting state, so that an arrow never compares against the wrong rank.
19. As someone in the room, I want every team to show "up" when the old board was an all-way tie, so that the first leader doesn't get a dash and everyone else a down arrow.
20. As someone in the room, I want teams that stay tied to show no change, so that a held tie doesn't read as a drop.
21. As someone in the room, I want a team that pulls level with another to show up, and the team it caught to stay level, so that the arrows match what happened.
22. As someone in the room, I want a Kahoot round's end-of-round reveal to compare against the board before the last question, not against the round's points backed out, so that a Kahoot round in the first round doesn't show bogus arrows.
23. As someone in the room, I want a regular round's reveal to compare against standings with this round's points backed out, so that arrows show movement over the round.
24. As someone in the room, I want a team with no points recorded for the round to count as scoring 0 that round, so that its arrow is still right.
25. As a quiz master, I want the admin's always-visible preview to show every team with no arrows and no reveal animation, so that the preview stays a plain list.
26. As someone in the room, I want the previous board remembered only while the question is still on air and the leaderboard hidden, so that a Kahoot question's points, which land as the question locks, still have an old total to count up from.
27. As someone in the room, I want the remembered board to stay put while the leaderboard is up, so that broadcasts during the board don't reset its basis.
28. As a developer, I want each leaderboard rule to be a pure function with table-driven tests, so that I can add a case in one line without rendering the DOM.
29. As a developer, I want the cap, reveal, old-pool and trend rules in one module, so that I can read them side by side.
30. As a developer, I want the previous-board capture rule next to the rules that use its result, so that the whole "what is the old board" question has one home.
31. As a developer, I want the leaderboard view to contain only animation and row rendering, so that a styling change doesn't risk a ranking rule.
32. As a developer, I want the leaderboard DOM tests to cover only the phase sequence and what a row renders, so that the view's tests are short and stable.
33. As a developer, I want the display page tests to keep passing unchanged, so that they confirm the wiring still behaves as before.

## Implementation Decisions

- **New leaderboard rows module (frontend, pure).** It sits beside the leaderboard view in the shared components and imports only shared types and the rank-label formatter. No React, no motion and no timers.
- **Row selection interface.** One function takes a single input object and returns the rows to render, in order:
  - Input: the current entries (already ranked by the server); optional previous entries; optional trend baseline; optional reveal count; optional cap (`maxRank`); optional current round index; and the animation phase (`old`, `counting` or `settled`).
  - Output: an ordered list of rows. Each row has the entry to draw (the old entry in `old`, the new entry in `counting` and `settled`), its 0-based rank index, its rank label, and its trend (`up`, `down`, `same`, or none).
  - The meaning of every input stays as the leaderboard's props document it today. Their documentation moves to the input type, and the view's props refer to it.
- **Rules owned by row selection,** each kept exactly as it behaves today:
  - The cap takes the first N entries by final standing and splits a tie at the cutoff.
  - The reveal walk counts whole rank groups bottom-up inside the capped pool, clamped to between 0 and the group count. It doesn't apply while the old board is animating; the whole pool shows.
  - The old pool is capped by final standing, holds each team's old value (0 for a newcomer), and is ranked with the shared ranking rule. An empty previous board stands in as the full roster at 0.
  - The trend basis is the previous entries, else the trend baseline, else the current round backed out. There is no trend when none of these is given. Ranks come from the shared ranking rule. "Up" is forced for every team when the basis has more than one team and no two different totals. Trend is reported only in the `settled` phase.
- **The view keeps presentation only.** The leaderboard view keeps the phase state and its two timers (hold, then count-up), the motion list items, the animated total, the bonus indicator, row classes by rank index, and the trend icon. It passes its phase and props to row selection and renders the result. Its props don't change.
- **Previous-board capture interface.** One function takes the remembered board and the latest snapshot's game status, leaderboard visibility and leaderboard. It returns the board to remember: the snapshot's leaderboard when the status is a question-on-air status, the leaderboard is hidden and the leaderboard is present and differs (by reference) from the remembered one; otherwise the remembered board unchanged. Returning the same reference when nothing changes is part of the contract, so the display page can keep its "adjust state during render" guard with no extra render.
- **The display page keeps its state and wiring.** It still holds the remembered board (starting empty) and still picks `previousEntries`, `trendBaseline` and `maxRank` from the Kahoot flags. Only the capture condition moves into the capture rule.
- **No shared-types, backend or protocol changes.** The server's ranks, reveal count and Kahoot top-N constant are used as they are.

## Testing Decisions

- **A good test gives an input and asserts the output.** For row selection: which teams appear, in what order, with which labels and trends. For capture: which board is remembered. Don't assert on helper functions or intermediate pools.
- **One new seam: the leaderboard rows module, table-driven (Vitest).** Port every rule case from the current leaderboard DOM tests into it:
  - reveal count omitted, 0, 1, growing and over the count
  - rank labels relative to the full standings
  - ties sharing a label
  - cap, cap omitted, cap splitting a tie, the walk inside the capped pool reaching rank 1
  - old and counting rows holding old order with old then new totals, and settled rows reordering
  - an empty previous board standing in at 0, capped
  - the old pool chosen by final standing when the old board had no ties
  - trend: none without a basis; up, down and same over a round; a missing round entry counting as 0; held, pulled-level and split ties against the trend baseline; the trend baseline winning over the round approximation; previous entries winning over both; forced "up" on an all-tied old board; no trend outside `settled`
  - capture: remembers on air while hidden; ignores while visible; ignores in non-on-air statuses; ignores an absent leaderboard; returns the same reference when unchanged
- **Prior art:** the pure-function tests in the frontend's lib tests (for example reorder-list and count-correct-answers) for shape, and the existing leaderboard DOM tests for the cases and fixtures.
- **The leaderboard DOM tests shrink to presentation.** Keep the bonus-star cases, the three-beat phase sequence with fake timers (opens old, counts up, settles), one smoke case that a revealed row renders its label, name, total and trend icon, and the plain preview rendering with no animation. Delete the rule cases once their table-driven equivalents pass.
- **The display page's completion-and-leaderboard tests stay unchanged.** They are the integration check that the capture rule and the wiring still produce the same board, including the regression where the between-questions board opens on the pre-grading total.

## Out of Scope

- Any change to what the leaderboard shows, its timing or its styling.
- Moving the previous-board capture to the server or into the snapshot.
- Changing the leaderboard's props, or merging previous entries, trend baseline and round index into one prop.
- The leaderboard on the control panel, phones or remote, and the teams table.
- The server's ranking rule, reveal count or Kahoot top-N cutoff (owned by the Standings module).
- The other candidates in the 2026-10-08 architecture review (the Session write module, change builders, live-edit, quiz editor, phase timers, sortable table).

## Further Notes

- Source: candidate 4 of the 2026-10-08 architecture review ("Splitting the long files"), rated Strong. Expected result: the leaderboard view goes from 526 lines to about 250, and the rule tests no longer need the DOM.
- This builds on the Standings module spec: entries arrive already ranked, and the view uses the shared ranking rule only for its previous board. That stays true here.
- No glossary or documentation change is expected, since behaviour is unchanged. If the module introduces a name worth keeping ("previous board", "trend basis"), add it to `GLOSSARY.md` in the same commit.
