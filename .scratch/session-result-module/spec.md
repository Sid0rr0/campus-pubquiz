# Spec: One Session result module for what a night's results mean

Status: ready-for-agent

Source: architecture review 2026-10-20, candidate 1 ("Strong", in-process).

## Problem Statement

The Standings module answers "who took part, and in which place?" for a session. Every screen that looks back at ended sessions then works out the rest for itself: whether a team won, whether it answered anything, how often a question was answered correctly, which question was hardest. The league table, the team page (`/team` and `/teams/:id`), the stats session detail and the break fun facts each carry their own copy of these rules, and the copies have drifted apart:

- **A team can win a night in the league but not on its own team page.** The league counts a night as won by every team placed 1st, so teams tied for first each win it. The team page counts a win only for the session's single Standings winner, the one the showdown or name order picked. A team that tied for first shows "1 night won" in the league table and "0 wins" on its team page, for the same night.
- **The stats page can name a closest_guess question the hardest question of the night.** A closest guess has one winner by design, so its correct rate says nothing about how hard it was. Fun facts already leave it out of the toughest question and room split, and DOCUMENTATION says so. The stats highlights (hardest, easiest, all correct, none correct, hardest round) don't, so nearly every night with a closest guess names it the hardest question.
- **The two average placings use different nights, and nothing says which.** The league averages only the nights a team answered at least one question (the nights that earn league points). The team page averages every night the team has a placing for. Both choices are reasonable, but each is buried in its own calc with its own rounding, so a reader can't tell whether the difference is intended.
- **Tied names are sorted two ways.** The ranking rule's name comparison exists so every screen orders tied names the same way. The stats page's fastest answer and fastest team, and the fun facts' fastest correct answer and clean-sweep list, still sort with the browser or Node locale comparison. Names with accents, capitals or digits can come out in a different order than on the leaderboard.
- **"Answered" is defined in a separate query in the league, and the correct count in another in team history.** Each reader loads its own extras next to the Standings read and joins them back by hand, finding each team in the leaderboard or the departed list again.

For a developer, every new reader of ended sessions (the league top five, the team page, feedback trends) has reinvented some of these rules. The rules that diverge sit in Postgres-backed service code, where only large database specs reach them, so nothing caught the drift.

## Solution

A single **Session result** module says what one ended session's results mean. It takes the session's Standings and the rows already stored for it (the questions played, the answers, the bonus awards) and returns:

- **per team:** its placing, whether it left, its total, answer points and bonus points, whether it answered at least one question, its correct count, whether it **won the night** (placed 1st, so tied teams each win it), and whether it is the **session winner** (the Standings module's single winner);
- **per question:** how many teams answered it, its correct count and its **correct rate**, which is empty for a closest_guess question;
- **for the session:** the participant count and the max points.

The league table, the team page and the stats session detail all build from it, so a night won, a night answered and a correct rate mean the same thing on every screen. The question correct-rate rule (verdict credit, and closest_guess has none) lives once in shared types. The Session result module and fun facts both use it.

What changes for users:

- The team page's **Wins** counts every night the team placed 1st, ties included, matching the league's nights won. The stats session detail still marks one row as the session's winner (the trophy row), which stays the single Standings winner.
- The stats session detail never names a closest_guess question as the hardest, easiest, all-correct or none-correct question. Its correct-rate cell shows "—", and closest_guess questions don't count towards a round's correct rate or the hardest round.
- Teams tied on the fastest answer or fastest average response, and the names in a clean sweep, are ordered the same way the leaderboard orders tied names.
- Average placing keeps its two definitions, now named and documented: the league averages the nights that count towards the league (the team answered at least one question); the team page averages every night the team has a placing for.

## User Stories

1. As a team that tied for first, I want my team page to count that night as a win, so that it agrees with the league table's nights won.
2. As a team that tied for first and lost the showdown, I want the night still counted as won on my team page and in the league, so that a tiebreak for the night's trophy doesn't erase a shared first place.
3. As a team, I want "wins" on my team page and "nights won" in the league to come from one rule, so that the two numbers can only differ when the league covers fewer nights.
4. As a quiz master reading the stats for a night, I want the trophy row in the standings table to still be the single session winner, so that the showdown winner is the one marked.
5. As a quiz master, I want the hardest question highlight never to be a closest_guess question, so that it points at a question the room actually found hard.
6. As a quiz master, I want the easiest question, all-correct and none-correct highlights to leave closest_guess out too, so that no highlight is decided by a question type that always has one winner.
7. As a quiz master, I want a closest_guess question's correct rate shown as "—" in the questions table, so that I don't read a meaningless percentage.
8. As a quiz master, I want a closest_guess question still listed with its answered count and correct count, so that I can see how many teams guessed and who was closest.
9. As a quiz master, I want a round's correct rate and the hardest round highlight to leave closest_guess questions out, so that a round with a closest guess isn't marked hard because of it.
10. As a quiz master, I want the stats page and the break fun facts to credit an answer the same way (correct in full, partial by its share of the points), so that "the toughest question" means the same thing on both.
11. As a quiz master, I want teams tied on the fastest answer ordered as the leaderboard orders them, so that the stats page doesn't name a different team than I'd expect from the board.
12. As a team on the big screen, I want the fastest correct answer fun fact to break a time tie in leaderboard name order, so that the same tie always names the same team.
13. As a team on the big screen, I want the clean-sweep fun fact to list teams in leaderboard name order, so that the list reads like the board.
14. As a league organiser, I want a league's average placing to cover only the nights that count towards the league, so that a night a team sat out without answering doesn't drag its tie-break down.
15. As a team, I want my team page's average placing to cover every night I have a placing for, so that it describes my whole history, not just league nights.
16. As a reader of the glossary, I want "night won", "session winner" and both average placings defined, so that I know which figure a screen shows.
17. As a team that answered nothing on a night, I want the league to give me no points for it and the team page still to list the night, as today.
18. As a team kicked from a night, I want that night to have no placing, no win and no share of the average placing on every screen, as today.
19. As a team, I want my correct count for a night on the team page to equal the correct count the stats page shows for my team that night.
20. As a team, I want my total for a night to be the same on the team page, the league's night and the stats page, so that one number describes one night.
21. As a quiz master, I want the max points of a night to be computed the same way on the team page (share of max points) and the stats page, so that a team's share agrees with the stats.
22. As an admin reordering leagues or editing a league's sessions, I want the league table built from the same results as every other screen, so that adding a night to a league never changes what that night means.
23. As a developer adding a new screen about past nights, I want one module that already answers "won, answered, placing, correct rate", so that I read fields instead of re-deriving rules.
24. As a developer, I want each of these rules tested as a pure function over plain rows, so that a rule change is a fast spec change, not a database fixture.
25. As a developer, I want one test that feeds the same night to the league and the team summary and checks they agree on wins, so that the two can't drift apart again.
26. As a developer, I want the league and team history services to stop loading their own "answered" and "correct count" queries, so that each figure has one source.
27. As a developer, I want the stats session detail's computation to read team and question figures from the Session result module, so that it only adds what is stats-only (response times, feedback, ratings, bonus summary).
28. As a developer, I want the ranking rule's name comparison to be the only way tied team names are ordered in results code, so that a lint-free `localeCompare` can't creep back in unnoticed.

## Implementation Decisions

### The Session result module

- A new pure, in-process module, **Session result**, lives beside the Standings module in the backend. It has no database access and no Nest dependencies. Its interface is one function from one ended session's inputs to its result.
- **Inputs** (plain rows, as the existing loaders already produce them):
  - the session's Standings (leaderboard with competition ranks, departed teams, participant count, single winner);
  - the questions played: id, round id, question type, points;
  - the answers: question id, team id, verdict, points awarded;
  - the bonus awards: team id, points.
- **Per-team result** (every participant: ranked teams first in Standings order, then the departed teams):
  - team id and name;
  - placing and placing-to (the competition rank and the end of its tie group), both empty for a team that left;
  - `hasLeft`;
  - total, answer points and bonus points, all taken from Standings and never re-summed;
  - `answered`: at least one stored answer in the session;
  - correct count: answers whose verdict is `correct`;
  - `wonNight`: placing is 1, so every tied team wins it and a team that left never does;
  - `isSessionWinner`: the team is the Standings module's single winner.
- **Per-question result**: question id, answered count, correct count, and correct rate.
  - The rate is the summed verdict credit divided by the participant count.
  - It is empty when the rate says nothing: a closest_guess question, or a session with no participants.
- **Session figures**: participant count and max points (the sum of the given questions' points).
- The module never ranks, sorts teams or recomputes totals. Placing, ties, the winner and participation stay owned by the Standings module and the ranking rule.

### Shared rules in shared types

- The **question correct-rate rule** moves into shared types as one module:
  - the verdict credit of an answer: `correct` counts 1; `partial` counts its points' share of the question's points, clamped to 0–1; anything else counts 0;
  - whether a question type has a meaningful rate (`closest_guess` does not), decided from the question type registry rather than a hard-coded type check, so that a future one-winner type is a registry change.
- Fun facts and the Session result module both use it. The two private copies of the credit function are deleted.
- **Average placing**: one shared function returns the unrounded mean of a list of placings (empty when there are none), and one returns it rounded for display to one decimal. Each caller decides which nights to pass in:
  - the league passes the nights that count towards the league;
  - the team page passes every night with a placing.
- **Name order**: every place in the results code that orders tied team names uses the ranking rule's name comparison. That covers the stats fastest answer and fastest team, and the fun facts fastest correct answer and clean sweep.

### Readers

- **Loading:** the Standings module gains a results read for a set of ended sessions. It loads each session's Standings (as it already does), plus that session's questions, answers and bonus awards, and returns the Session result per session. This is the only new database code. It replaces:
  - the league's separate "answered" query;
  - team history's separate correct-count query and its max-points query;
  - team history's hand-written lookup that finds each team in the leaderboard or the departed list.
- **League:**
  - Each team night is built from a per-team result: placing, `answered`, `wonNight`.
  - The league table counts nights won from `wonNight`. Its behaviour is unchanged.
  - It ranks teams with the ranking rule where it can. It keeps its own comparator for points, then nights won, then unrounded average placing, then name, and its tie test for "level on all three". Generalising the ranking rule to take a comparator is allowed, but not required.
- **Team history:**
  - A team's session row and its summary are built from the per-team result and the session figures.
  - **Wins counts nights where `wonNight` is true.** It no longer uses the set of sessions the team was the single winner of, and that set goes away.
  - Podiums, best placing and average placing are unchanged.
  - The team directory's average-placing column keeps using the same average placing function as the team page.
- **Stats session detail:**
  - The standings rows take placing, left, totals, correct count and `isSessionWinner` (the trophy row) from the per-team result.
  - The questions table takes answered count, correct count and correct rate from the per-question result.
  - The hardest, easiest, all-correct and none-correct highlights consider only questions with a correct rate.
  - A round's correct rate and the hardest round consider only the round's questions that have a correct rate. A round with none has no rate and can't be the hardest.
  - Response times, the bonus summary, feedback and ratings stay in the stats computation.
- **Wire shapes:**
  - The session detail question row's correct rate becomes nullable. It is null for closest_guess, and the page shows "—".
  - A round row's correct rate becomes nullable in the same way.
  - The team history summary keeps its fields. Only the meaning of `wins` changes.
  - No other payload changes.
- **Fun facts** stay a live computation over the session in memory. They keep their roster-only denominator, because they describe a session still being played. Only the credit and meaningful-rate rule, and the name order, come from shared code.

### Docs, in the same change

- **GLOSSARY.md** gains these terms:
  - **Session result:** the module and what it holds.
  - **Night won:** placed 1st in an ended session; every tied team wins it; never a team that left.
  - **Session winner:** the single team the Standings module picks, by showdown or name order. It is the trophy row on the stats page and is not the same as a night won.
  - **Correct rate**, including that closest_guess has none.
- **GLOSSARY.md** also updates:
  - **Average placing**, to say the league version covers only the nights that count towards the league;
  - **League table**, to point at **Night won**.
- **DOCUMENTATION.md:**
  - the team page's win rule becomes "placing 1, ties included";
  - the stats correct-rate paragraph and highlights say closest_guess has no rate;
  - the round correct rate leaves closest_guess out.

## Testing Decisions

- **What makes a good test:** it gives the module plain input rows and checks only the result it returns. It never asserts on how the module got there: no spying on helpers, no checking which internal function ran. The interface is the test surface.
- **The Session result module** gets a pure spec, which is the main test surface. One case each for:
  - a tie for first gives `wonNight` to every tied team and `isSessionWinner` to one;
  - a team that left has no placing, never wins, and still counts in the participant count;
  - a team on the roster that answered nothing has `answered: false` and keeps its placing;
  - a closest_guess question has no correct rate but keeps its answered and correct counts;
  - a partial answer counts its share and a speed-scaled correct answer counts in full;
  - a session with no participants has no rates;
  - totals come from Standings unchanged (bonus included, never re-summed).
- **The shared correct-rate rule and average placing** get small specs in shared types, beside the ranking rule's tests.
- **A cross-reader consistency spec** (pure): one set of nights feeds both the league night builder and the team summary, and the test checks that nights won, wins and placings agree. This is the test that would have caught the drift.
- **Stats session detail:** the existing pure calc spec gains cases for:
  - a closest_guess question that would otherwise be the hardest is never a highlight;
  - its rate is null;
  - round rates leave it out;
  - fastest answer and fastest team ties follow the ranking rule's name order.
  - Existing cases whose fixtures assume the old behaviour are updated, not deleted.
- **Fun facts:** the existing spec gains a tie-order case for the fastest correct answer and the clean sweep. Its closest_guess cases stay as they are.
- **Loading:** one real-Postgres spec for the new Standings results read checks that the rows reach the module:
  - a departed team's answers and bonuses are included;
  - questions come from the session's quiz;
  - only ended sessions are read.
  - It uses the per-worker cloned test database the Standings, league and team history specs already use.
- **Service specs** (league table, team history, stats) keep their happy paths and the cases that test loading and HTTP shape. Cases that only tested a derived rule move to the Session result spec. The team history case that pinned "a tie for first is not a win" is rewritten to the new rule.
- **Prior art:**
  - the league table calc spec and the session detail calc spec (pure calcs over rows);
  - the ranking rule tests in shared types;
  - the Standings service spec (real Postgres, cloned per worker).
- E2E: run `pnpm e2e` once before the PR. No new journey: the team page and stats smoke checks already open these screens.

## Out of Scope

- A shared ended-sessions read adapter for the participants union, max points, session display name and the ended-status filter (architecture review candidate 4). That includes the team directory's "sessions joined" count, which still differs for kicked teams.
- Fixing the team directory's cost of loading every team's history to sort by average placing.
- Fun facts' denominator (live roster only), which is right for a session still in play.
- The bonus award count wording: stats counts every award, penalties included; fun facts count positive awards only.
- Folding the live results reads (leaderboard, verdict tallies, fun fact data, league top) into one read (architecture review candidate 5).
- Any change to how the Standings module ranks, breaks ties, picks the single winner or decides who took part.
- League points, the league table's tie-break order, and which sessions count towards a league.

## Further Notes

- Decisions confirmed with the user on 2026-10-20:
  - one pure seam, with loading kept in the existing services;
  - a win is every team placed 1st;
  - average placing leaves out nights a team answered nothing only in the league.
- The single session winner is still needed: it is the stats trophy row, the stats list's winner column and sort, and the showdown's purpose. This spec only stops the team page using it for "wins".
- Teams whose page showed fewer wins than their league nights won will see the number go up after this ships. That is the intended fix, not a regression.
