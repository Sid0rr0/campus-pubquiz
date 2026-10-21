# Spec: Prior standings as the only trend basis

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 3 ("Worth exploring", in-process).

## Problem Statement

When the big screen shows the leaderboard, each team gets a trend arrow: up, down or same, against where it stood before the latest scoring. The app works out "where it stood before" in two different ways, depending on the round.

- **In a kahoot round** it compares against the **Prior standings**: the board as it was when the question went in front of the teams.
- **Everywhere else** it takes today's board and subtracts each team's points from every round of the block in play, approximating the board before the block.

Two rules for the same idea have produced bugs. The last two trend fixes both came from this split:

- freezing the Prior standings when a question opens;
- backing out every round of the block, not just the last.

They have also left differences that quiz masters see on the big screen:

- **The first ordinary block of the night starts with odd arrows.** Before it, every team is on 0. In a kahoot round that all-tied start makes every team show up. In an ordinary block, the leader shows "same" and every other team shows "down", although nobody went down.
- **A bonus award during an ordinary block doesn't move the arrows.** The back-out only subtracts round points, so a selfie bonus given in the break counts as if it had been there before the block. Between kahoot questions the same bonus counts as movement.
- **A team that joined mid-block gets an arrow against a made-up board.** Backing out the block puts it on 0 before the block, so it usually shows up. In a kahoot round, a team that wasn't on the prior board gets no arrow.

For a developer, the rule for "the board before the latest scoring" is split in two:

- when to freeze the Prior standings lives in the backend's Session write;
- the back-out arithmetic lives in shared types, next to the leaderboard description.

A change to either has to understand both, and each has its own special case (the all-tied patch only applies to a real prior board).

## Solution

The **Prior standings** become the only basis for trends, in every round. They are frozen once per block: the board as it stood just before the block's first question went in front of the teams. In a kahoot round every question is its own block, so they are frozen before each question, exactly as today. In an ordinary block they are frozen once, before its first question, and kept through its later rounds, its break and its reveal. Trend arrows compare each team's rank now with its rank on that board. The back-out arithmetic is deleted.

The rule for when to freeze moves into shared types, next to the leaderboard description that reads it, so "the board before the latest scoring" has one home.

What quiz masters see change:

- On the first ordinary block of the night, every team shows up (everyone was tied on 0 before it), as already happens in a kahoot round.
- A bonus award during an ordinary block counts as movement on the board that follows, as already happens between kahoot questions.
- A team that joined during an ordinary block gets no trend arrow on that block's board, as already happens in a kahoot round.
- After a backend restart, a board shown before the next block's first question opens has no trend arrows, as the count-up board already has none. The next block's board has arrows again.

Otherwise the arrows are the same as today: a team that kept its rank across a multi-round block shows no movement, and a kahoot round's arrows and count-up board don't change.

## User Stories

1. As a quiz master, I want trend arrows in every round to compare against the board as it stood before the block started, so that the arrows mean the same thing in a kahoot round and an ordinary block.
2. As a quiz master, I want every team to show up on the first ordinary block's leaderboard when everyone started on 0, so that the room doesn't see "down" arrows for teams that didn't go down.
3. As a quiz master, I want a team that kept its rank across a block of several rounds to show no movement, so that scoring in an earlier round of the block doesn't fake a change.
4. As a quiz master, I want a bonus award given during a block (on air, in the break or during the reveal) to count as movement on the board that follows, so that a selfie bonus that lifts a team shows as an up arrow.
5. As a quiz master, I want a bonus award given before a block starts to count as part of the board before it, so that it doesn't show as movement on the next block's board.
6. As a quiz master, I want answers scored on air (auto-graded at submit) during a block to count as movement on that block's board, so that they aren't hidden in the "before" board.
7. As a quiz master, I want hand grades and the lock's batch grading in the break to count as movement on the block's board, so that the whole block's scoring shows.
8. As a quiz master, I want a key fix during the break or the reveal to count as movement on the block's board, so that a corrected answer moves the arrows like any other grade.
9. As a quiz master, I want the board before a block kept through every round of that block, so that the second round's intro doesn't reset what the arrows compare against.
10. As a quiz master, I want stepping back with Previous out of a block's first question and pressing Advance again not to reset the board before the block, so that points already scored on air in this block still show as movement.
11. As a quiz master, I want showing and hiding the leaderboard during a block not to reset the board before the block, so that I can check the board mid-block without changing the arrows at the reveal.
12. As a quiz master, I want showing and hiding the join overlay not to reset the board before the block, so that letting a late team in doesn't change the arrows.
13. As a quiz master running a kahoot round, I want the arrows and the count-up board between questions to behave exactly as today, so that this work changes nothing in a kahoot round.
14. As a quiz master running a kahoot round, I want the round-end and quiz-end boards still to compare against the board before the round's last question, so that the final arrows show the last question's movement.
15. As a quiz master, I want a team that joined during a block to get no arrow on that block's board, so that it isn't shown moving against a board it wasn't on.
16. As a quiz master, I want a team that left during a block to stay off the board as today, so that its absence doesn't move anyone else's arrow by itself beyond the rank change it causes.
17. As a quiz master whose backend restarted mid-block, I want that block's board to show no arrows rather than wrong ones, so that the room never sees an arrow computed from a board that wasn't really "before".
18. As a quiz master whose backend restarted, I want arrows back from the next block onward, so that a restart costs at most one block's arrows.
19. As a quiz master, I want the end-of-quiz board after an ordinary last block to compare against the board before that block, so that the final arrows show the last block's movement.
20. As a quiz master, I want a reloaded or reconnected big screen to show the same arrows as one connected throughout, so that a refresh never changes the board.
21. As a team on the leaderboard, I want my arrow to say whether I climbed or fell this block, so that I can see how the block went for us.
22. As a developer, I want one rule deciding when the board before the latest scoring is taken, next to the leaderboard description that reads it, so that a trend bug has one place to look.
23. As a developer, I want no arithmetic that rebuilds an earlier board from round points, so that bonus awards, newcomers and multi-round blocks can't trip it.
24. As a developer, I want the all-tied rule to apply to every prior board, so that it has no special case for one kind of basis.
25. As a developer, I want the Session write to keep storing the Prior standings, but not to decide when they are taken, so that it stays the one place a session is stored without owning trend rules.
26. As a developer reading the glossary, I want Prior standings to say they are taken once per block, so that the term matches the code.

## Implementation Decisions

### When the Prior standings are taken

- **Which write freezes them.** The Prior standings are taken by the write that puts the block in play's first question in front of the teams for that block. They become the leaderboard the write started from. Three conditions must all hold:
  - **The question is being answered after the write and wasn't before it.** It is on air with the leaderboard hidden after the write, and wasn't before. This is today's opening test, including "not stepping back into it out of a graded status".
  - **It is the block's first question.** The question on air is the first question of the block in play for the new progress, asked through the Block module.
  - **The Prior standings aren't already this block's.**
- **They carry their block.** The Prior standings carry the block they were taken for, identified by the block's first question id. The session record gains this alongside the standings. It is ephemeral like the standings: empty in a fresh or restored session.
- **What this gives in each case:**
  - **Kahoot rounds:** every question is its own block, so each question's opening (hiding the between-questions board) takes them. That is today's behaviour.
  - **Multi-round blocks:** opening the first question of a later round in the same block is not the block's first question, so nothing is taken.
  - **Previous:** stepping back from the block's first question to its round intro (or further) and pressing Advance again reopens the same block, so nothing is taken.
  - **The leaderboard and the join overlay:** toggling either over a question that is already being answered is no new block, so nothing is taken.
  - **Restart:** a restored session has no Prior standings and no block. Opening a question that isn't a block's first takes nothing, so the rest of that block has no basis. The next block's first question takes them again.
- **Where the rule lives.** The rule moves from the backend's per-field session updates into shared types, beside the leaderboard description, as one pure function from the session a write started from and the session it ends with to the session with its Prior standings brought up to date.
- **What the Session write keeps.** It still applies the rule once per write, before the standings are re-read, and stores the result. It no longer owns the rule.

### Trends

- The trend basis is always the Prior standings. Each shown team's rank is compared with its rank on them, ranked with the shared ranking rule.
- **No basis:**
  - With no Prior standings (after a restart, before the next block's first question), no team has a trend.
  - A team missing from the Prior standings (it joined after they were taken) has no trend.
- **All tied.** When the Prior standings have more than one team and all are tied on total points, every shown team that is on them is up. This now holds in every round, including the first ordinary block of the night.
- **Deleted:**
  - the round back-out (the rounds of the latest scoring, and each team's total with those rounds removed);
  - the "is this a real prior board" flag on the trend basis.
- **Count-up board:** unchanged. It is still present only between kahoot questions, built from the Prior standings, and absent after a restart.

### Wire shapes

- The display view's leaderboard description keeps its shape (entries, optional count-up board, trends per team id). Only which teams have a trend, and what it is, changes in the cases listed in the Solution.

### Docs, in the same change

- **GLOSSARY.md, Prior standings:**
  - taken once per block, by the write that first puts the block's first question in front of the teams, and kept for the rest of the block (in a kahoot round, once per question);
  - the only basis for trends as well as the count-up board;
  - a restored session has none until the next block's first question, so boards before then have no trends and no count-up board.
- **DOCUMENTATION.md, the leaderboard description's `trends`:**
  - the basis is the Prior standings in every round;
  - every team is up when they were all tied;
  - a team missing from the basis, or every team when there is no basis (after a restart, until the next block), has no trend;
  - the back-out sentence is deleted.
- **The `/guide` page:** no change; it doesn't mention trend arrows.

## Testing Decisions

- **What makes a good test:** it drives a real session through the gateway (presses, answers, bonus awards, a restart) and checks the leaderboard description the display view is sent. It never inspects the session record's Prior standings field or calls the freeze rule directly. Confirmed with the user: no new seam.
- **The leaderboard description real-store spec** gains cases for an ordinary block:
  - **All tied at the start:** on the first ordinary block, from everyone on 0, every team is up. This replaces the existing "ordinary round" case that pinned "same" for the leader and "down" for the rest.
  - **Multi-round block:** a block of several rounds where a team scores in an earlier round and keeps its rank shows no movement. The existing "backs out every round of the block" case is kept and must pass.
  - **Bonus during the block:** a bonus award given in the break of an ordinary block moves the awarded team's arrow on the reveal board.
  - **Bonus before the block:** a bonus award given before the block's first question opens doesn't show as movement.
  - **Previous and Advance again:** Previous from the block's first question to its round intro, then Advance again, keeps the earlier basis, so points scored on air before the Previous still show as movement.
  - **Leaderboard toggle mid-block:** showing and hiding the leaderboard during the block doesn't change the reveal board's arrows.
  - **Late joiner:** a team that joined during an ordinary block has no trend on that block's board.
  - **Restart mid-block:** after a restart in the middle of an ordinary block, that block's board has no trends; the next block's board has them again.
- **Kahoot cases pass unchanged:** between questions, round end and quiz end, the all-tied case and the bonus-on-air case.
- **The prior standings real-store spec:** its count-up cases pass unchanged. One case is added: opening the first question of a later round in the same ordinary block doesn't take new Prior standings, observed through the reveal board's trends.
- **Prior art:**
  - the leaderboard description and prior standings real-store specs;
  - the existing restart cases (the real-store harness's restart);
  - the existing bonus-on-air case.
- **E2E:** run `pnpm e2e` once before the PR. No new journey.

## Out of Scope

- **Saving the Prior standings** so they survive a restart. The user chose no arrows until the next block instead.
- **Count-up board behaviour:** any change to the count-up board, the leaderboard reveal walk, the kahoot top-five cap or the reveal count.
- **Trend vibration:** any change to how the phone shows its own rank or vibrates on an up trend. It already reads the trend it is sent.
- **Ranking:** the ranking rule, tie-breaking and the leaderboard's entries.
- **Stats trends:** trends on the stats or feedback pages. "Feedback trends" is an unrelated feature.

## Further Notes

- Confirmed with the user on 2026-10-21:
  - after a restart, no trends until the next block's first question (no persistence, no back-out fallback);
  - accepted behaviour changes: all teams up from an all-tied start in an ordinary block, bonus awards during a block move trends, a mid-block joiner gets no arrow;
  - tests stay at the existing real-store seam.
- The block identity on the Prior standings is what keeps a multi-round block, Previous, and a leaderboard toggle from re-freezing. It replaces both the back-out arithmetic and the risk that today's "any opening from off air" rule would re-freeze at a later round of the same block.
