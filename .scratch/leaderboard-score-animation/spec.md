# Leaderboard score animation and perfect rounds

Status: ready-for-agent

## Problem Statement

When a pub quiz block's results land, the big-screen leaderboard reveals ranks bottom-up, but every total just appears. The room can't see how much a team gained in the block, which is the moment people cheer about. The quickfire board between questions already counts scores up, but even there nobody can read the gain at a glance. A team that gets every question of a round right gets no recognition on the board, and nothing in the break celebrates it either.

## Solution

On the big-screen leaderboard, for the boards that show a block's results:

- **Pub quiz**: the bottom-up rank walk stays as it is. Each row, as its rank is revealed, comes in on the team's prior total and counts up to its new total. There's no reordering, because the rows already arrive in their new order.
- **Quickfire**: the existing hold → count-up → reorder sequence stays.
- **Both modes**: a floating "+x" (green for a gain, "−x" in red for a loss) sits just outside the row's right border. It shows during the count-up and fades about 2 s after the board settles.
- **Both modes**: an animated 🔥 to the right of the total for each **Perfect round** (see `GLOSSARY.md`) the team had in the block just scored.

In the break, a new fun fact says how many teams have had a perfect round so far ("5 teams have had a perfect round so far"), or names the team when there's only one ("Only Quizzly Bears has had a perfect round").

A leaderboard brought up mid-block draws a plain board, as it does today. Phones are unchanged.

## User Stories

1. As a player watching the big screen, I want each team's total to count up from its old score when its rank is revealed, so that I can feel the block's points land.
2. As a player, I want to see "+x" next to a team's row, so that I can tell at a glance how many points it gained in the block.
3. As a player, I want a loss shown as a red "−x", so that a negative bonus or a bad block is as visible as a gain.
4. As a player, I want no "+0" on a team that gained nothing, so that the board isn't cluttered with zeros.
5. As a player on a team that joined mid-block, I want no misleading "+x" computed from a zero start, so that my team's row isn't overstated.
6. As a player, I want the "+x" to float outside the row's border and fade after the board settles, so that it celebrates the change without permanently crowding the row.
7. As a player in a quickfire quiz, I want the existing count-up between questions to also show "+x", so that I can see who scored on the last question.
8. As a pub quiz player, I want the bottom-up rank reveal to keep its suspense, so that the count-up doesn't spoil who's on top.
9. As a team that got every question of a round right, I want a 🔥 next to our score, so that the room sees our perfect round.
10. As a team with two perfect rounds in one block, I want 🔥🔥, so that each perfect round gets its own brag.
11. As a player, I want the 🔥 to the right of the score, so that the name, total and fire read in a natural order.
12. As a player, I want a partial answer to rule out a perfect round, so that the 🔥 means everything was fully right.
13. As a player, I want an unanswered question to rule out a perfect round, so that skipping a question isn't rewarded.
14. As a player, I want a correct Clue answer on any clue to count towards a perfect round, so that answering late doesn't cost the 🔥.
15. As a quickfire player, I want a correct but slow answer to count towards a perfect round, so that the 🔥 is about being right, not about speed.
16. As a player, I want closest-guess questions left out of the perfect-round check, so that a round isn't ruled out just because only one team can be closest.
17. As a player, I want a round of only closest-guess questions never to count as perfect, so that the 🔥 is never handed out for a round where nothing could be got right.
18. As a quiz master, I want a leaderboard I bring up mid-block to stay plain (no count-up, no "+x", no 🔥), so that it doesn't hint at answers graded on air before the reveal.
19. As a quiz master, I want the count-up, "+x" and 🔥 to stay on every leaderboard I bring up from the block's results until the next block's first question opens, so that toggling the board after the reveal shows the same celebration.
20. As a quiz master using Early answer reveal, I want the leaderboard that comes up after the break to count up and show "+x" and 🔥, so that the results moment works in that flow too.
21. As a player, I want the final board's list rows to count up and show "+x" for the last block, so that the final block lands like every other.
22. As a player, I want the podium on the final board to stay as it is, so that the winners' moment isn't changed.
23. As a player, I want no 🔥 on the final board, so that the podium stays the focus.
24. As a player with reduced motion turned on, I want the totals to swap instantly and the "+x" and 🔥 to be static, so that the board is still readable without movement.
25. As a quickfire player, I want the 🔥 on the board that follows a round's last question, so that the perfect round is recognised when it's complete.
26. As a player whose team is outside a capped quickfire board, I accept that my team gets no row, so neither a "+x" nor a 🔥.
27. As a big screen that reloads or reconnects mid-board, I want to draw the same "+x" and 🔥, so that a reload doesn't lose them.
28. As a player watching the break screen, I want a fun fact counting the teams that have had a perfect round so far, so that perfect rounds are celebrated beyond the leaderboard.
29. As a player on the only team with a perfect round, I want the fun fact to name us, so that we get the credit.
30. As a player, I want the perfect-round fun fact skipped when no team has had one, so that the rotator doesn't show "0 teams".
31. As a player, I want the perfect-round fact counted over every revealed round so far, so that it still says something new in later breaks.
32. As a player, I want a team with several perfect rounds counted once in the fact, so that the number is "teams", not "rounds".
33. As a player, I want the clean sweep fact still shown alongside the new one, so that a whole-block sweep keeps its own mention.
34. As a player, I want the "+x" to include the joker's doubling and any bonus awards, so that it matches exactly how much the total moved.
35. As a quiz master, I want hand grades, key fixes and bonuses made while the board is up to update the "+x" and 🔥, so that the board never shows stale figures.

## Implementation Decisions

- **Glossary**: **Perfect round** is already defined in `GLOSSARY.md`. Use it in code names and docs. Don't introduce "clean round" or "full marks".
- **Results window**: the boards described as "showing a block's results" are the leaderboard boards from the moment the prior standings' block has started its results (its `reveal_intro`, or, with Early answer reveal, leaving its break) until the next block's first question opens, plus the final board. That includes the next block's `round_intro` and any toggle in between. Outside the window (a leaderboard brought up while the block is still being answered or is locked/in break) the board carries none of the new fields. In quickfire, every question is its own block, so the window is the existing between-questions count-up board and the board following a round's last question.
- **Board description (shared types)**: `describeLeaderboardBoard` stays the single place that decides what the big screen draws. `LeaderboardBoard` gains two optional fields, both present only inside the results window and only listing shown (capped) teams:
  - `pointsGained: Record<teamId, number>`: the team's current total minus its total in the prior standings, kept to the nearest half point. Teams missing from the prior standings are left out, and teams on exactly 0 are left out.
  - `perfectRounds: Record<teamId, number>`: how many rounds of the prior standings' block the team has a perfect round in. Teams with 0 are left out. Never set on the final board.
  - The existing `countUpBoard` stays quickfire-only. The pub quiz's per-row count-up starts from `total − pointsGained`.
- **Perfect-round detection**: one shared pure helper, used by both the board description and the fun fact. It reads the verdicts from the session's fun fact data. A round is perfect for a team when the team has a `correct` verdict on every question of the round whose type has a meaningful correct rate (the same filter the clean sweep uses to leave out closest-guess questions). A round with no such questions is never perfect. Partial, incorrect and missing answers all break it.
- **Live updates**: both fields are derived from the live results and prior standings on every emit, so grades, key fixes, bonuses and reconnects stay consistent without extra state. After a backend restart there are no prior standings, so there's no `pointsGained` until the next block, matching trends today. `perfectRounds` does not depend on the prior standings' totals, but it does need the prior standings' block, so it also disappears until then.
- **Fun fact (shared types)**: a new `FunFact` kind `perfect_rounds` with `{ teamCount: number; teamName?: string }`. `teamName` is present only when `teamCount` is 1. It counts distinct teams with at least one perfect round across every revealed round so far (the same "revealed" set the other facts use), and it's skipped at 0. It sits next to `clean_sweep` in the fun fact order. Fun facts only show on the pub quiz break screen, so quickfire never shows it.
- **Leaderboard component (frontend)**:
  - Pub quiz (no `countUpBoard`): a row revealed by the rank walk that has a `pointsGained` entry counts its total up from `total − gained` over the existing count-up duration, starting on the row's entrance. When a newer rank is revealed, the count-up is cut to its end, the same way the entrance is.
  - Quickfire: the existing three-phase sequence is unchanged, and the "+x" appears with the counting phase.
  - "+x" is placed outside the row's right border, green for a gain and red with a "−" for a loss. It fades about 2 s after the row settles.
  - 🔥 is rendered once per perfect round to the right of the total, with a small looping flicker.
  - Reduced motion: the total swaps instantly, and the "+x" and 🔥 are static. The "+x" still fades, as a plain opacity change.
  - Accessibility: the "+x" and 🔥 have text labels (e.g. "gained 3 points", "2 perfect rounds").
- **Fun fact rotator (frontend)**: words `perfect_rounds` as "N teams have had a perfect round so far" (or "1 team…" if the copy needs it) or "Only <team> has had a perfect round".
- **Docs**: DOCUMENTATION.md's leaderboard board section (the two new fields and the results window) and its fun facts table (the new kind). `/guide` is unchanged, because the moderator does nothing new.

## Testing Decisions

- Good tests here go through the public functions and the rendered component and check what a viewer or client receives. They don't test the private perfect-round helper or animation internals directly.
- **`describeLeaderboardBoard`** (prior art: the existing leaderboard board tests in shared types, including the count-up board and joker stamp cases), covering:
  - `pointsGained` inside the window for the pub quiz (at the reveal, at the next round intro, with Early answer reveal after the break) and for quickfire
  - no new fields on a mid-block toggle
  - newcomers left out, zero gains left out, negative gains kept
  - joker doubling and bonuses included in the gain
  - capped quickfire teams left out
  - `perfectRounds` counting multiple perfect rounds, partial/unanswered breaking it, closest-guess questions left out, a round of only closest-guess questions never perfect, and Clue and slow quickfire answers counting
  - no `perfectRounds` on the final board
- **`describeFunFacts`** (prior art: the `clean_sweep` cases in the fun facts tests): the count across revealed rounds, a team counted once, `teamName` only when the count is 1, skipped at 0, and unrevealed rounds not counted.
- **`Leaderboard` component** (prior art: the existing leaderboard component tests, which already drive the count-up phases and the joker stamp with fake timers):
  - a revealed pub quiz row starts at `total − gained` and ends at the total
  - the "+x"/"−x" renders with its label, and is absent without an entry
  - one 🔥 per perfect round, right of the total
  - reduced motion renders the final values statically
- **Fun fact rotator**: the wording of both forms of the new fact.
- No e2e journey: the behaviour is pure description plus drawing, and both are covered above.

## Out of Scope

- Phones (the `leaderboard` phone screen, my standing): no count-up, "+x" or 🔥.
- 🔥 on the final board or the podium, and any podium change.
- A plain board brought up mid-block stays exactly as today.
- Storing perfect rounds anywhere (team page, stats, league, session detail).
- A `/guide` change.
- A new sound for the count-up or the 🔥.

## Further Notes

- A board brought up during a block's reveal already shows totals including the whole block. The 🔥 there can likewise reflect questions not yet revealed one by one. This matches how totals and trends already behave and is accepted.
- A live answer-key fix or a bonus while the board is up changes the "+x" and 🔥 on the next emit. The count-up does not replay mid-mount, matching the existing once-per-mount count-up rule.
