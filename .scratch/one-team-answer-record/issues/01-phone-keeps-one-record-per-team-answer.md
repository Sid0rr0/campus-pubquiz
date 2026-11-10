# 01: The phone keeps one record per team answer

**What to build:** The phone's team link stores each team answer as one record, `{ value, grade, clue }`, keyed by question id. One function builds the record from the server's answer, whether a `TeamAnswerView` (on join or in the team answers sync) or an `AnswerReceivedPayload` (on acknowledgement). A receipt replaces that question's record whole.

Every `/play` reader takes the one map and reads the field it needs:

- the play page
- the opened-questions builder
- the reveal verdict card
- the question browser
- the question picker

The separate grade and clue maps, their builders and the question browser's clue prop are deleted.

Teams see the same `/play` as before, with one deliberate exception: a revised answer that the server no longer grades automatically drops its old grade straight away. See the spec for the full decisions.

**Blocked by:** None within this spec. Across specs, wait for `clue-answer-module` ticket 02 (phone freeze state) to be done, because both edit the question browser's freeze check.

**Status:** done

- [ ] Before changing the receipt semantics, confirm in the backend's answer submit path that a revised, now-ungraded answer has its `gradedAt` cleared on the row. If it doesn't, stop and report.
- [ ] The team link state and the hook's game object expose `myAnswers` as `Record<number, MyAnswer>`, where `MyAnswer` is `{ value: string; grade: MyAnswerGrade | null; clue: MyAnswerClue | null }`. `myAnswerGrades` and `myAnswerClues` no longer exist.
- [ ] Join accepted, team answers synced and answer received all build records with the same function. Identity change clears the map.
- [ ] The play page, the opened-questions builder and the reveal verdict card each take the one map. The question browser reads the selected question's `value` and `clue` from it and has no separate clue prop.
- [ ] The team link reducer tests assert one record per question, including:
  - a receipt with `gradedAt: null` for a previously graded question leaves `grade: null`
  - a Clue receipt carries `clue: { clue, value }`
  - join and sync still restore or replace wholesale
- [ ] The shared `/play` test utilities gain one helper that builds a `MyAnswer`. Fixtures use it.
- [ ] Every existing `/play` rendering test passes with unchanged expectations, apart from the deliberate grade-drop case.
- [ ] `pnpm typecheck`, `pnpm --filter frontend test` and `pnpm crap:changed` pass.
