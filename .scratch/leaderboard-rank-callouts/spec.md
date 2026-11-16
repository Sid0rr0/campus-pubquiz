# Spec: Rank callouts on the admin console and presenter remote

Status: ready-for-agent

Blocked by: —

## Problem Statement

When the quiz master reveals the leaderboard on the big screen, rank by rank from the bottom up, they have nothing to say beyond the team name and total. The interesting things about each team are scattered or invisible: did they get a perfect round, how many points they gained in the block, did they climb, are they one point behind the team above, did their joker pay off. The admin console's question browser can preview questions, title cards and breaks, but not the leaderboard. The quiz master can't see which rank comes next either, so they can't set up the next line while the room is still reacting.

## Solution

A **Rank callout** (see `GLOSSARY.md`) for every team on the leaderboard: short lines the quiz master can read aloud, worked out from the night's results. Teams and the big screen never see callouts.

- **Live**: while the leaderboard is up on the big screen, the admin console's detail column shows a leaderboard card. It shows the rank group just revealed, large, with its callouts, and the next group to be revealed, dimmed, also with its callouts. The presenter remote's Notes section shows the same.
- **Preview**: the question browser gets a 🏆 marker after each block's break marker (after each round in a quickfire quiz). Clicking it shows only the quiz master that block's board, bottom-up, with every team's callouts, the same way clicking a question previews it.

## User Stories

1. As a quiz master, I want the detail column to switch to a leaderboard card when the leaderboard goes up on the big screen, so that I have something to say as each rank is revealed.
2. As a quiz master, I want the detail column to keep showing the item I clicked if I had picked something in the browser before the board went up, so that the board doesn't interrupt my grading (the existing follow rule).
3. As a quiz master, I want the rank group the latest Advance revealed shown large, so that I can read it at a glance on stage.
4. As a quiz master, I want the group the next Advance will reveal shown dimmed below it, so that I can set up the next announcement.
5. As a quiz master, I want the dimmed next group to carry its callouts too, so that I can prepare what I'll say about it.
6. As a quiz master, I want only a "next" group shown before the first Advance on the board, so that I know who comes first.
7. As a quiz master, I want no "next" group once the winner is revealed, so that I know the reveal is over.
8. As a quiz master, I want tied teams shown together as one group, the way the big screen reveals them, so that the card matches the screen.
9. As a quiz master, I want a team's perfect rounds named ("Perfect round: Music 🔥"), so that I can say which round they aced.
10. As a quiz master, I want to see the points a team gained in the block ("+14 this block"), so that I can call out a big comeback.
11. As a quiz master, I want a team's rank movement ("up from 7th", "down from 2nd", "holds 4th"), so that I can narrate the race.
12. As a quiz master, I want to see when a team's joker doubled a round in the block ("Joker 2× on Sport"), so that I can say whether it paid off.
13. As a quiz master, I want a team's bonus and penalty points ("+3 bonus", "−2 penalty"), so that I can remind the room of the shot or selfie that earned them.
14. As a quiz master, I want the gap to the place above ("2 points behind 3rd"), so that I can build tension.
15. As a quiz master, I want the leader's margin ("leads by 5"), or "shares the lead" when tied at the top, so that I can announce the winner properly.
16. As a quiz master, I want ties named ("tied with Quizzly Bears"), so that I can call them out.
17. As a quiz master, I want the team (or teams) with the biggest gain of the block marked ("biggest gain this block"), so that I can single them out.
18. As a quiz master, I want the final board to show whole-quiz perfect rounds ("3 perfect rounds tonight") and no block-only lines, so that the closing callouts summarise the night.
19. As a quiz master, I want the board between quickfire questions to show the top 5 with their gains and no current/next split, because it appears all at once.
20. As a quiz master, I want a 🏆 marker after each block's break marker in the question browser, so that I can look at any block's board.
21. As a quiz master, I want a past block's 🏆 card to show the board as it stood after that block, with callouts for that block, so that it matches what the room saw then.
22. As a quiz master, I want rank movement on a past block's board measured against the block before it, so that it matches the trend arrows the big screen showed.
23. As a quiz master, I want the 🏆 marker of the block in play to preview the board it's about to produce, tagged "grading not finished" while answers are ungraded, so that I can prepare during the break without trusting incomplete totals.
24. As a quiz master, I want the 🏆 markers of later blocks greyed out and not clickable, so that I don't open a board that doesn't exist yet.
25. As a quiz master, I want the last block's 🏆 marker to show the final board, so that I can prepare the closing.
26. As a quiz master running a quickfire quiz, I want one 🏆 marker per round rather than per question, so that the browser stays readable.
27. As a quiz master, I want a team that was kicked or left to still appear on the past boards it was part of, tagged "left", so that past boards match what the room saw.
28. As a quiz master, I want the 🏆 marker of the board on the big screen to get the green on-air ring, like on-air questions, so that I can tell which board is live.
29. As a quiz master on stage with the presenter remote, I want its Notes section to show the current and next callouts while the leaderboard is up, so that I don't need the laptop.
30. As a quiz master, I want a bonus I award to count in the board of the block I awarded it in, so that past boards stay accurate.
31. As a team, I never want to see callouts on my phone or the big screen, so that the quiz master gets to tell the story.
32. As a quiz master, I want the `/guide` page to explain the leaderboard card and the 🏆 markers, so that a new moderator knows they exist.

## Implementation Decisions

- **New pure module in shared types: Rank callouts.** It owns every rule above and reads only session state: the leaderboard entries' per-round points, the answer verdicts and power-ups in the fun fact data, the jokers, the bonus awards and the block structure (the Block module). It has two entry points:
  - *Block board*: for a given block (identified the way prior standings are, by its first question id), the board as it stood after that block. Each team is ranked by the rule shared types already use for rankings, with its callouts. The board carries whether it is the final board, whether it is a preview with grading unfinished, and which teams have left.
  - *Live board*: for the leaderboard on air, the current group (or none), the next group (or none), each with callouts, or the all-at-once top-5 form for the between-questions quickfire board. It follows the leaderboard reveal count and the tie grouping the big screen already uses, so the card and the screen never disagree.
- **A past block's totals** are each team's per-round points summed over the rounds up to the end of that block, plus the bonus awards recorded for that block or earlier. A block's movement, gain and biggest gain compare it with the board of the block before it. The first block has no previous board, so it has no movement lines. When every team was tied before it, the existing "everyone moved up" rule applies, as it does for big-screen trends.
- **Perfect rounds by name** reuse the existing perfect round rule, applied to each round of the block separately so the rounds can be named. On the final board, perfect rounds are counted over the whole quiz.
- **The joker line** reuses the existing rule for which rounds a team doubled (its joker round or a bought extra joker).
- **Gap**: the points behind the group directly above. The leader gets "leads by N" over 2nd, tied leaders get "shares the lead", and a lone team gets no gap line.
- **Biggest gain**: every team with the block's highest positive gain, ties included. No line when nobody gained.
- **Quickfire quiz**: block boards are built per round (a marker after each round), not per question.
- **Teams that left**: they appear on any board they took part in (the existing "took part" rule) and carry a "left" flag.
- **Schema change**: bonus awards record the block they were awarded in (the first question id of the block in play when awarded). The column is nullable: awards made before this change have none and count in the latest board only. Migration via `db:migrate:create`.
- **Live results**: the bonus awards in the fun fact data carry their team and block, so the module stays pure.
- **Admin view**: gains the block boards for every block reached so far (including a preview of the block in play) and the live board while the leaderboard is up. The quiz master's room is the only one sent callouts.
- **Presenter context** (the remote): gains the live board while the leaderboard is up.
- **Admin console**: the question browser adds a 🏆 detail item per block, placed after that block's break marker. The detail column draws a leaderboard card for it. The on-air item becomes the live leaderboard card while the board is up, under the existing manual-pick-sticks follow rule.
- **Presenter remote**: the Notes section draws the current and next callouts while the board is up, in place of question or round notes.
- **Docs in the same change**: `DOCUMENTATION.md` (admin view, presenter context, the bonus award's block) and the `/guide` page (the leaderboard card and the 🏆 markers). Glossary **Rank callout** is already written.

## Testing Decisions

- A good test checks behaviour through the module's public entry points against plain session fixtures, never internal helpers. Assert on what the quiz master would read (which teams, which lines), not on intermediate totals.
- **Rank callouts module (main seam)**: block boards across several blocks (totals, movement against the previous block, the first block having no movement), gaps and ties including tied leaders, named perfect rounds and the final board's whole-quiz count, biggest gain with ties and with no gain, joker lines, bonuses placed by block plus unstamped awards landing in the latest board, the in-play preview flag while grading is open, quickfire boards per round, teams that left, and the live board's current and next groups at reveal count 0, mid-reveal and fully revealed, the tie grouping, and the between-questions quickfire top 5. Prior art: `leaderboard-board.test.ts`, `fun-facts.test.ts`, `perfect-rounds.test.ts`, `leaderboard-reveal.test.ts`.
- **Backend**: the existing bonus-award spec checks that an award stores the block in play and that the live results carry it with its team. Prior art: the bonus module's DB-backed specs.
- **Frontend**: the existing `/control` component tests (the `leaderboard.test.tsx`, `on-air-cards.test.tsx` and `question-browser-notes.test.tsx` style). They check that the 🏆 markers appear after break markers, that later blocks are disabled, that the on-air card follows the board unless something was picked, that current is shown with next dimmed, and the preview tag. The `/remote` tests check that the Notes section shows the callouts while the board is up. These only check that what the server sends gets drawn.
- Run `pnpm crap:changed` before committing. Optionally run `pnpm mutate:changed` on the new module.

## Out of Scope

- Showing callouts on phones or the big screen.
- Editing or writing callouts by hand.
- Placing bonus awards made before this change into past blocks.
- Per-question 🏆 markers in a quickfire quiz.
- Callouts on the stats page, team page or league.
- Recording which callouts were read out.

## Further Notes

- Glossary term: **Rank callout**. Avoid "leaderboard notes", because notes are what the quiz author writes.
- The live card must use the same reveal count and tie grouping as the big screen. If they drift, the quiz master announces a team the room can't see yet.
