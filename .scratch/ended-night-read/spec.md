# Spec: One ended-night read for the stats page and the Team page

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 5 ("Worth exploring", local-substitutable).

## Problem Statement

Two screens show an ended night question by question. The stats session detail (with its Scoresheet) shows every team's answers. The **Team page** shows one team's own answers. Each one reads the night separately, in its own SQL and its own mapping code:

- **Both copies join the quiz's questions to its rounds by quiz id, then read the session's answers.** The stats detail reads every team's answers, joined to team names. The Team page reads one team's answers. The joins, column lists and number conversions are written twice.
- **Both copies word the key and the answers.** Each one parses every question's payload to get its options, then words the Answer key and each stored answer with `formatAnswer`. The stats detail shares one parse per question across all answers. The Team page parses per row. They agree today only because both call the same helpers.
- **Only one copy numbers and orders the questions.** The Team page orders questions in SQL (round order, then question order) and computes each question's round number and question number in a loop. The stats detail sorts later in its calc module. The Scoresheet works out its "Round N" headers on the frontend. "Question 3 of round 2" means the same thing on both screens only if the two orderings agree.
- **Both copies read the quiz's current rows.** An ended night is shown with the quiz as it is now, not as it was played. Editing, rewording or deleting a question afterwards changes old nights on both screens. That may be the right source or it may not, but today the choice is made in two places. Moving to a per-session copy later would mean changing both, and keeping them in step.

For a developer, a change to how an ended night's questions are worded, numbered or sourced (a new question type with its own wording, a fix to numbering, freezing the questions per session) has to be made twice. Only two large service specs check the copies, and neither knows about the other.

## Solution

The **Ended-sessions read** module gains one **night read**. Given an ended session, and optionally one team, it returns:

- the night's questions in play order: round order, then question order. Each question has its round id and title, round number, question number, prompt, type, answer kind, points and worded Answer key;
- the stored answers, worded the way the screens show them, with team id and team name, verdict, points awarded, graded-at and response time. When a team is given, only that team's answers are read.

The stats session detail and the Team page's night both read from it. Each one keeps only what it does with the night: the stats calc turns it into per-question rates, highlights and the Scoresheet, and the Team page pairs each question with the team's own answer.

Where the questions come from (today: the quiz's current rows) is decided inside the night read and nowhere else.

What changes for users: nothing. Both screens show the same questions, numbers, wording, verdicts and points as before. The stats page still shows every team's answers, and the Team page still only ever reads the team's own.

## User Stories

1. As a quiz master on the stats page, I want each question's Answer key worded the same as before, so that nothing on the page changes.
2. As a quiz master on the stats page, I want each team's answer worded the way the screens showed it on the night (option text, not option indices), as today.
3. As a quiz master reading the Scoresheet, I want every team that took part to have a row and every question a column, in play order, as today.
4. As a quiz master reading the Scoresheet, I want a kicked or departed team's answers still shown, as today.
5. As a quiz master, I want each question's correct rate, answered count and fastest response to be computed from the same answers as before, so that the figures don't move.
6. As a team on my Team page, I want every question of the night in play order with its round title, round number and question number, as today.
7. As a team on my Team page, I want my own answer, its verdict and the points I earned next to the right answer, as today.
8. As a team on my Team page, I want a question I didn't answer shown with no answer and 0 points, as today.
9. As a team, I want my Team page never to read another team's answers, so that the read itself can't leak them.
10. As a team that was kicked from a night, I want my Team page to still show my answers for it, as today.
11. As a team, I want a night that hasn't ended, or one I took no part in, to stay not found on my Team page, as today.
12. As a team and a quiz master looking at the same night, I want "round 2, question 3" to name the same question on the Team page and on the stats page.
13. As a team and a quiz master looking at the same night, I want the Answer key and my answer worded identically on the Team page and on the stats page.
14. As a quiz master, I want a question type's wording rule to reach both screens from one place, so that a new type can't be worded one way on the stats page and another on the Team page.
15. As a quiz master, I want a choice question whose payload no longer parses to fail the same way on both screens, rather than one screen showing it and the other not.
16. As a developer, I want the night's questions, numbering and wording read once, so that a change to any of them is one edit.
17. As a developer, I want the choice of where an ended night's questions come from made in one place, so that freezing questions per session later is a change to one read.
18. As a developer, I want the numbering rule (round number from round order, question number within its round, starting at 1) defined once and pinned by a test.
19. As a developer, I want the read narrowed to one team in SQL, not filtered after loading every team's answers, so that the Team page stays cheap and private.
20. As a developer, I want one real-Postgres spec on the night read that covers ordering, numbering, wording, a team narrowing, an unanswered question and a kicked team's answers, so that the service specs don't each need those fixtures.
21. As a developer, I want the stats service's session detail to keep loading round ratings, feedback, bonus awards and Standings as it does now, so that only the questions-and-answers part moves.
22. As a developer, I want each payload parsed once per question in the night read, shared by the key and every answer to it, as the stats detail does today.

## Implementation Decisions

- **Home:** the night read lives in the Ended-sessions read module beside `endedSession`, `participations` and `participants`. That module already owns the database side of looking back at past nights. The read is part of that, not a new module.
- **Interface (shape, not final names):** `night(gameSessionId, { teamId? })` → `{ questions: NightQuestion[], answers: NightAnswer[] }`.
  - `NightQuestion`: question id, round id, round title, round number, question number, order index, prompt, type, answer kind, points (number), worded Answer key.
  - `NightAnswer`: question id, team id, team name, verdict, points awarded (number), graded-at, response time in ms (number or null), worded answer.
  - Questions come back in play order. Numbers start at 1. Round number follows round order among the quiz's rounds. Question number counts within its round.
- **The read does not check status or participation.** Callers already fetch the header with `endedSession` (which returns null for a session that hasn't ended) before reading the night. The Team page already checks "took part" through Standings before reading it. The night read trusts its caller and documents that, so the checks aren't run twice. A caller that skips the header check gets the questions of a live session, which is why the read sits beside `endedSession` and its doc comment says to call that first.
- **Team narrowing happens in SQL.** With a team id, only that team's answer rows are queried. The Team page's privacy rule (never another team's answers) holds at the read, not only at the caller.
- **Wording:** one payload parse per question, shared by the key and every answer to it. The key and each answer are worded with the shared `formatAnswer` helper. Answer kind comes from `resolveAnswerKind`. The read returns worded strings only. Neither caller needs the raw stored value.
- **Question source:** the read joins the session's quiz's current rounds and questions, as both callers do today. This is the one place that choice is made. Changing it (for example to a per-session snapshot) is out of scope here.
- **Stats session detail:** it stops querying questions and answers and stops building its own wording map. It passes the night read's questions and answers into `computeSessionDetail`. Its input rows can stay as they are, mapped from the night read, or narrow to the night read's types. The calc keeps its own sort, or relies on the read's order. It still loads rounds separately for round titles, categories and ratings, because rounds with no questions still need a row.
- **Team page night:** `nightByCode` keeps the code lookup, the header and the took-part check. It then reads the night narrowed to the team and pairs each question with that team's answer (or none). The numbering loop and the per-row payload parse go away.
- **No schema, protocol or payload changes.** `SessionDetailStats` and `TeamNightDetail` keep their current shapes. The Scoresheet keeps working out its "Round N" headers on the frontend.

## Testing Decisions

- **A good test here checks what a caller sees through the read's interface**: which questions come back, in what order, with what numbers and wording, and which answers come back for which team. It doesn't assert SQL shape, query count or how the payload parse is shared.
- **Seam:** the night read on the Ended-sessions read module, tested against real Postgres in its existing spec (`ended-sessions-read.spec.ts`, using the real-store harness and its seeding helpers). Cases:
  - questions in round order then question order, across rounds whose order index differs from their id order;
  - round number and question number start at 1 and restart per round;
  - the key and the answers of a choice question are worded with option text;
  - with no team, every team's answers, with team names; with a team, only that team's;
  - an unanswered question still comes back, with no answer for it;
  - a kicked team's answers still come back when narrowed to that team;
  - points, points awarded and response time come back as numbers, and a missing response time as null.
- **Regression guards, kept as they are:** the stats service spec (`stats.service.spec.ts`: "wires … rows into the computed detail", "words each correct answer and team answer the way the screens show it", the kicked-team correct-rate case) and the Team page controller spec (`team-page.controller.spec.ts`: "returns every question in order…", the not-ended, never-joined and kicked-team cases). They must pass unchanged, since nothing visible changes. Fixtures that become redundant with the night read's spec can be trimmed, but no assertion about the payloads is weakened.
- **Prior art:** the existing `ended-sessions-read.spec.ts` cases for `participants` and `participations` (real Postgres, kicked-team fixtures) and the `computeSessionDetail` calc spec for pure figures.

## Out of Scope

- Freezing an ended night's questions per session, so that later quiz edits don't rewrite old nights. This spec only moves that choice into one place.
- Changing what the stats page or the Team page shows, including adding round or question numbers to `SessionDetailStats` or moving the Scoresheet's "Round N" headers to the backend.
- The Session result module's own question and answer loading in Standings, and the Question outcome consolidation (review candidate 1).
- Round ratings, feedback, bonus awards and player counts on the stats detail.
- The league and the team directory.

## Further Notes

- The night read should be a small, deep addition: one call that hides the joins, ordering, numbering and wording behind `(session, team?) → night`.
- If the per-session question snapshot is picked up later, start from the night read. It is the only reader of an ended night's questions apart from the Session result loading in Standings, which would need the same change.
- No `GLOSSARY.md` or `DOCUMENTATION.md` change is needed, since behaviour is unchanged. If a name for "an ended night's questions and answers" proves useful, add it to `GLOSSARY.md` beside **Scoresheet** and **Team page**.
