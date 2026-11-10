# One record per team answer on the phone

Status: ready-for-agent

Source: architecture review 2026-11-10, candidate 4 ("One record per team answer on the phone", rated "worth exploring").

## Problem Statement

A developer working on `/play` handles one team answer as three separate maps, each keyed by question id:

- `myAnswers`: the value
- `myAnswerGrades`: the grade, present only once graded
- `myAnswerClues`: the recorded clue and its worth, present only for a Clue question

The server already sends all three fields together on one object: a `TeamAnswerView` in the join and in the team answers sync, and an `AnswerReceivedPayload` on acknowledgement. The phone's team link splits that object up in two places, with three small builders on the join and sync path and a patch to each map on receipt. Every reader then joins the maps back together:

- the play page passes two or three of them down
- the question browser reads one by id and takes the clue as a separate prop
- the reveal verdict card takes two
- the opened-questions builder takes two

As a result, adding a field to the team's answer means touching every layer. Readers can also see an inconsistent answer: on receipt, an answer that came back ungraded keeps whatever grade the phone stored earlier for that question, and an answer with no clue keeps the clue stored earlier. The server's answer row no longer has either.

## Solution

The team link keeps one record per team answer, `{ value, grade, clue }`, keyed by question id. One function builds the record from the server's answer, whether it arrives as a view or a receipt. A receipt replaces that question's record whole, so the phone always holds what the server last said about the answer. `/play` passes the one map down, and each reader takes the field it needs.

Teams see no difference, except in one edge: an answer revised so that it is no longer graded automatically now drops its old grade straight away, instead of keeping it until the next sync.

## User Stories

1. As a developer adding a field to a team's answer, I want one record shape on the phone, so that I change the builder and the readers that need the field, not three maps and their props.
2. As a developer reading the team link, I want the join, the team answers sync and the answer receipt to build the record with the same function, so that the three paths can't disagree.
3. As a developer, I want the play page to pass one answers map down, so that `/play` components take fewer props.
4. As a developer, I want the question browser to read the selected question's clue from the team's answer record, so that it no longer needs a separate prop for the clue.
5. As a developer, I want the reveal verdict card and the opened-questions builder to take one map, so that they can't be given a value map and a grade map from different moments.
6. As a developer writing reducer tests, I want to assert one record per question, so that a test reads the way the server sends the answer.
7. As a team, I want my answer to show on my phone the moment the server acknowledges it, as it does now.
8. As a team, I want the question picker to keep marking the questions I've answered, so that I can see what's left in the block.
9. As a team, I want my grade, verdict and points to show on the reveal exactly as now, so that the review is unchanged.
10. As a team, I want an unanswered revealed question to keep showing 0 points, so that the review is unchanged.
11. As a team answering a Clue question, I want my locked-in clue and its worth to keep showing, and my answer to show as frozen exactly as now, so that the Clue question behaves the same.
12. As a team that revised an answer that had been graded automatically into one waiting for the quiz master, I want my phone to stop showing the old grade, so that it never shows a grade the server has since cleared.
13. As a team that cleared a Clue answer, I want the phone to hold no recorded clue for it if the server recorded none, so that the phone matches the server.
14. As a team reconnecting, I want the join to restore every answer with its grade and clue in one go, as now.
15. As a team, I want the team answers sync after a grade or key fix to replace my answers wholesale, as now, so that grades the quiz master changed appear.
16. As a team whose phone's identity changes, I want the previous team's answers cleared, as now.
17. As a team, I want an answer typed while disconnected and resent on rejoin to still land in my answers once acknowledged, as now.

## Implementation Decisions

- **Record shape (phone, team link).** `MyAnswer` is `{ value: string; grade: MyAnswerGrade | null; clue: MyAnswerClue | null }`. `MyAnswerGrade` (`pointsAwarded`, `gradedAt`, `verdict`) and `MyAnswerClue` (`clue`, `value`) keep their shapes. `grade` is non-null only when the server's answer has a `gradedAt`. `clue` is non-null only when the server's answer has both `clue` and `clueValue`.
- **One builder.** One function turns the fields that `TeamAnswerView` and `AnswerReceivedPayload` share (`questionId`, `value`, `pointsAwarded`, `gradedAt`, `verdict`, `clue`, `clueValue`) into a `MyAnswer`. A second one-liner builds the map from a list. The existing value, grade and clue builders are deleted.
- **Team link state.** `myAnswers` becomes `Record<number, MyAnswer>`. `myAnswerGrades` and `myAnswerClues` are removed from the team link state and from the hook's game object. Join accepted, team answers synced and identity change build or clear the one map. Answer received replaces that question's entry with the record built from the payload.
- **Receipt semantics change (deliberate).** Today a receipt with `gradedAt: null`, or with no clue, keeps the phone's earlier grade or clue for that question. The record is now replaced whole, matching the server row. The implementer should confirm in the backend's answer submit path that a revised, now-ungraded answer has its `gradedAt` cleared on the row. If it doesn't, stop and report it rather than keeping the old merge.
- **Readers.**
  - The play page passes `myAnswers` only.
  - The opened-questions builder takes `seenQuestions` and `myAnswers`. It reads `value` for "my answer" and `grade` once revealed. The "0 for an unanswered revealed question" rule is unchanged.
  - The reveal verdict card takes `myAnswers` only.
  - The question browser takes `myAnswers` and reads `.value` and `.clue` for the selected question. Its separate clue prop is removed.
  - The question picker keeps its "answered" check (`id in myAnswers`).
  - Every rendered output stays the same.
- **No wire change.** `TeamAnswerView`, `AnswerReceivedPayload` and the socket protocol don't change. DOCUMENTATION.md, GLOSSARY.md and `/guide` don't change.
- **Ordering with the Clue answer module spec.** That spec's phone ticket replaces the question browser's freeze check, which reads the team's recorded clue. This spec runs after it, and passes the record's `clue` and `value` to whatever freeze-state call that ticket leaves in place.

## Testing Decisions

- A good test drives the team link through its events (join accepted, answer received, team answers synced, identity change) and asserts the resulting `myAnswers`. It renders `/play` components from props and asserts what the team sees. It doesn't assert which builder ran.
- Seams, highest first, all already in place. No new seam is added.
  1. **Team link reducer** (prior art: the frontend's `team-link-team-data.test.ts` and `team-link-reducer-edges.test.ts`). Rewrite the answer assertions to check one record per question. Add:
     - a receipt with `gradedAt: null` for a question that was graded leaves `grade: null` (the deliberate change)
     - a receipt for a Clue question carries `clue: { clue, value }`
     - join, sync and identity change still restore, replace or clear wholesale
  2. **Hook adapter** (prior art: `use-team-link-team-data.test.ts` and `use-team-link-adapter-edges.test.ts`): the game object exposes the one map.
  3. **`/play` rendering** (prior art: `opened-questions.test.ts`, `reveal-verdict-card.test.tsx`, `break-and-reveal.test.tsx`, `clue-list.test.tsx`, `answered-questions.test.tsx`, and the answer-type tests). Expectations stay as they are. Only the fixtures change, built through the shared `/play` test utilities, which should gain one helper that makes a `MyAnswer`.
- Typecheck finds every fixture still passing the old maps.
- Run `pnpm crap:changed` before committing.

## Out of Scope

- The server, the shared answer views and the socket protocol.
- The Clue freeze rule itself, and how the phone recognises a Clue question. Both belong to the Clue answer module spec.
- The quiz master's and the admin's answer data on `/control`, which use other payloads.
- Candidates 1, 2, 3 and 5 of the same architecture review.

## Further Notes

- The review rated this candidate "worth exploring". The payoff is fewer props and one builder. Besides the deliberate receipt semantics change above, the only change a team can see is fresher data.
- If a `/play` rendering test's expectation has to change, other than the deliberate grade-drop case, that's a regression. Fix the code, not the test.
- Commit scope: `refactor(frontend)`.
