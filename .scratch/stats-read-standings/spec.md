# Spec: Stats take totals from the Standings module and credit answers by verdict

Status: ready-for-agent

Source: architecture review 2026-10-14, candidate 6 ("Speculative", local-substitutable).

## Problem Statement

The stats pages already read the Standings module for who took part, who won and how teams rank. Two pieces of scoring knowledge are still worked out separately inside the stats module.

- **The played-sessions list sorts by numbers it computes itself.**
  - The list shows each session's team count and winner from the Standings module.
  - Sorting by team count or by winner uses the stats module's own SQL. That SQL copies the Standings module's rules: who took part (roster, answers or bonus awards), a team's total (answer points plus bonus points, pre-aggregated so answers and awards don't fan out), and which teams can win (roster teams only).
  - The two agree today. If the Standings module's notion of a total or of taking part changes, the list will sort by one number and show another, and nothing will fail.
- **A question's correct rate on the session detail page decides partial credit by answer kind.** A question whose answer kind is `match` is rated by points earned out of points achievable; every other question counts only answers whose verdict is `correct`. But the verdict already records partial credit:
  - A free_text, audio or YouTube answer the quiz master grades with some but not all of the points is `partial`. It counts as wrong in its question's correct rate, so a question where every team got half marks shows 0% and can be named the hardest question.
  - A kahoot `match` answer that was fully correct but speed-scaled is rated by its scaled points, so a fast all-correct kahoot match question shows less than 100%, unlike a kahoot multiple-choice question.

For a quiz master reading the stats, sorting the list by winner can't contradict the winner column today, but the hardest and easiest question highlights can be misleading when they hand-graded partial marks.

For a developer, any change to how a total is counted has to be made twice, and the answer-kind check in the stats module is scoring knowledge living outside scoring.

## Solution

The Standings module provides the per-session totals the list sorts by: the participant count and the winner's total. The stats module builds its sort from those instead of its own copy. The number a list is sorted by is, by construction, the number its rows show.

A question's correct rate credits each answer by its verdict:

- a `correct` answer counts in full;
- a `partial` answer counts as its share of the question's points;
- an `incorrect` or ungraded answer counts nothing.

No answer kind is consulted. `match` partial credit stays as it is, hand-graded partial marks start to count, and a correct kahoot answer counts in full whatever its speed-scaled points.

## User Stories

1. As a quiz master, I want the played-sessions list sorted by winner to order sessions by the winning points each row shows, so that the order matches what I read.
2. As a quiz master, I want the played-sessions list sorted by teams to order sessions by the team count each row shows, so that the order matches what I read.
3. As a quiz master, I want teams that were kicked or left but answered or got a bonus award to count as taking part in the list's team count and its sort, as today, so that participation means the same everywhere.
4. As a quiz master, I want a departed team never to be a session's winner in the list or its sort, as today, so that only teams still on the roster can win.
5. As a quiz master, I want negative bonus awards (penalties) included in the winner's total for sorting, as today, so that the sort uses the same total as the leaderboard.
6. As a quiz master, I want a session with no roster teams to sort below every session with a winner, as today, so that empty sessions don't float to the top.
7. As a quiz master, I want sorting, paging and the total count of played sessions to behave exactly as today, so that the list doesn't change under me.
8. As a quiz master, I want a question where teams got partial marks I gave by hand to show a correct rate that reflects those marks, so that the question doesn't look like nobody got it.
9. As a quiz master, I want the hardest question highlight not to pick a question where every team earned partial marks over one nobody got, so that the highlight is fair.
10. As a quiz master, I want a `match` question's correct rate to keep crediting the pairs teams got right, as today, so that close attempts still count.
11. As a quiz master, I want a correct kahoot answer to count fully in its question's correct rate whatever its speed score, so that kahoot questions are rated like any other.
12. As a quiz master, I want ungraded answers to count as not correct in the correct rate, as today, so that unfinished grading doesn't inflate the rate.
13. As a quiz master, I want a question's "correct" count (how many teams got it fully right) to stay exactly as today, so that the all-correct and none-correct highlights don't change.
14. As a quiz master, I want the round correct rates, points percentages, difficulty label and standings table to stay exactly as they are, so that only the question correct rate changes.
15. As a developer, I want the totals the list sorts by to come from the Standings module, so that changing how a total is counted is a one-module change.
16. As a developer, I want the stats module to hold no copy of the participation or total rules, so that it can't drift from the Standings module.
17. As a developer, I want a question's correct rate to read only verdicts and points, never the answer kind, so that scoring knowledge stays in scoring.
18. As a developer, I want a test that the list's sort order agrees with what its rows show, so that drift between the two fails a test.

## Implementation Decisions

- **The Standings module exposes the session totals for sorting.** Next to its standings for a set of sessions, it provides per-session totals as a query the stats module can join and order by. The rows are:
  - the participant count: roster teams plus any team with an answer or bonus award in the session;
  - the winner's total: the highest total among roster teams, where a team's total is its answer points plus bonus points, or none for an empty roster.

  It is built from the same participant and per-team total subqueries the Standings module's own standings use, so there is one definition of each.

- **The interface hands over a query, not numbers.** The list sorts and pages in SQL across every ended session, so the stats module needs something it can join and order by. Loading standings for every session would defeat paging. The Standings module owns the SQL; the stats module only joins it and picks the column to order by.
- **The winner's total is the highest roster total.** This doesn't depend on how ties are broken, so it is safe to sort on in SQL while the winner's name still comes from the Standings module's ranking for the page.
- **The stats module keeps** the max-points subquery (a quiz fact, not a standings one), the session title and played-at ordering, the tiebreak on session id and the page count.
- **A question's correct rate credits each answer by verdict:**
  - `correct` scores 1;
  - `partial` scores the answer's points divided by the question's points, capped to between 0 and 1;
  - `incorrect` or ungraded (no verdict) scores 0.

  The rate is the sum divided by the participant count, as today. The answer-kind branch goes away. The question's correct count (fully correct answers) is unchanged, and so are the highlights that use it (all correct, none correct).

- **The hardest and easiest question highlights** keep using the question correct rate, so they pick up the new crediting automatically.
- **Round correct rates and points percentages are unchanged.** A round's correct rate still counts fully correct answers. Changing it is a separate decision.
- **No schema change and no change to the shared stats payload shapes.** Only the values of a question's correct rate change, in the cases listed above.
- **Docs.**
  - DOCUMENTATION.md: wherever it describes the stats page's correct rate, describe the verdict-based credit.
  - GLOSSARY.md: no change, unless the implementation needs to name the correct rate.

## Testing Decisions

- **A good test seeds ended sessions and reads what the stats pages return.** It never asserts the shape of the SQL or which subquery was joined.
- **The stats module's Postgres spec** covers the list's sort agreement. Seed several ended sessions whose sort order would differ if the rules drifted:
  - a departed team with the highest total;
  - a team whose negative bonus changes the winner;
  - an empty roster;
  - a team that only got a bonus award.

  Sorting by winner, both directions, orders the rows by the winning points they show, with the empty roster below every winner (first ascending, last descending). Sorting by teams orders them by the team count they show. Paging and the total stay right. Prior art: the existing stats module spec, and the Standings module spec for seeding departed teams and bonuses.

- **The pure session-detail calculation spec** covers the correct rate. Cases:
  - a free_text question where teams got partial hand-graded marks: rate equals the summed shares;
  - a `match` question with partial pairs: same rate as today;
  - a kahoot question with correct but speed-scaled answers: rate 1 when everyone was correct;
  - ungraded answers count 0;
  - the hardest question highlight picks a question with no credit over one with partial credit;
  - the correct count and the all-correct and none-correct highlights are unchanged.

  Prior art: the existing session-detail calculation spec.

- **The Standings module's own spec stays as it is.** The shared subqueries are exercised through it and through the stats list spec.

## Out of Scope

- Round correct rates. They still count only fully correct answers. Making them verdict-based like the question rate is a separate decision.
- The frontend "N correct" count on the control panel and the presenter remote. It already counts `correct` verdicts, which is right for "how many got it".
- Moving the max-points sum into another module.
- Any change to how the Standings module ranks or breaks ties.

## Further Notes

- The sort part is drift prevention. The stats module and the Standings module agree today, and the stats area changes rarely, which is why the review rated this "Speculative". The correct-rate part changes visible numbers in two cases (hand-graded partial marks, speed-scaled correct kahoot `match` answers). Both are fixes to how a question's difficulty is reported.
- If the shared totals query turns out awkward to expose from the Standings module, the fallback is a stats Postgres spec asserting the sort agreement on its own. That test is the main win either way.
