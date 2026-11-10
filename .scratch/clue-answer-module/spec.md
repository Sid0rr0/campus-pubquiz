# Spec: One Clue answer module for the freeze rule and an answer's worth

Status: ready-for-agent

Source: architecture review 2026-11-10, candidate 1 ("Make the Clue answer rule one module").

## Problem Statement

The **Clue question** has two rules about a team's answer:

- **Freeze:** once another clue is shown, a non-blank answer recorded on an earlier clue can no longer be changed.
- **Worth:** a right answer is worth half a point for every clue the room had not yet seen when the team answered.

Both rules are coded in more than one place, and the copies can drift apart:

- **The freeze rule is coded twice.** The server's Answer service decides which clue a submission is recorded on, or refuses it as locked. The phone's question browser separately decides whether the team's answer shows as frozen and whether a warning is due. Nothing keeps the two in step. If they drift, the phone can let a team type an answer the server will refuse, or warn the team about a freeze that never happens.
- **Worth has two formulas with two inputs.** Grading and the "Worth N points now" line use the question's clue count. The answer views (`AnswerView` and `TeamAnswerView`) work it out from the stored question's points instead. The two only agree while points equal clues × 0.5.
- **The phone guesses the question type.** It treats a question as a Clue question when `highestClue` and `clueCount` are both present, instead of asking the question's type.
- **The freeze rule has no fast test.** It is only covered by the Postgres-backed Answer service spec, so changing it means running a database test.

For a team this is a fairness risk on stage. For a developer it means a Clue change has to be made in three places.

## Solution

Add one pure **Clue answer** module to `shared/types`. It answers three questions from the question (its type and clue count) and the team's answer:

1. **Record or freeze:** given the stored answer (value and recorded clue), the new value and the highest clue shown, which clue does this write record, or is it frozen?
2. **Frozen now / can freeze:** is the team's current answer frozen at the highest clue shown, and can a later clue still freeze it?
3. **Worth:** what is a right answer worth at a given clue?

The server and the phone both call it. The Answer service keeps only I/O: it loads the stored answer, asks the module, turns "frozen" into `AnswerLockedError`, and writes the row. The phone's question browser asks the module whether to show the answer as frozen and whether to warn. Every place that shows or grades a worth uses one formula based on the clue count. `clueValueFromPoints` is deleted.

Teams, the quiz master and the big screen see no change in behaviour.

## User Stories

1. As a team, I want the phone to show my Clue answer as frozen exactly when the server would refuse a change, so that I'm never told I can edit an answer the server will reject.
2. As a team, I want the phone never to show my answer as frozen when the server would accept a change, so that I'm not stopped from improving my answer while the same clue is up.
3. As a team, I want the "a new clue will lock this in" warning to show only while a clue is left to show, so that I'm not warned after the last clue.
4. As a team, I want a blank answer or "I don't know" never to freeze, so that I can clear my answer and answer later at the lower value.
5. As a team, I want resending my unchanged answer after a new clue to keep its original clue, so that a resend or a reconnect doesn't cost me points.
6. As a team, I want my first answer to a Clue question to be recorded on the highest clue shown, so that I'm scored for when I actually answered.
7. As a team, I want the worth shown on my phone for my locked-in answer to match what I score if it's right, so that the number I see is the number I get.
8. As a team, I want the "Worth N points now" line and my answer's recorded worth to follow the same formula, so that they never disagree for the same clue.
9. As a team rejoining after a reconnect, I want my answer's recorded clue and worth to come back the same as before, so that the reconnect doesn't change what my answer shows.
10. As a quiz master, I want an answer's worth in the answers panel to be the same as its auto-grade, so that Correct gives the team what the rule says.
11. As a quiz master, I want an answer's worth to still be right after I fix the answer key during a live session, so that the grade options match the clue the answer was recorded on.
12. As a quiz master, I want a team that tries to change a frozen answer to get the same "Your answer is locked in" message as today, so that nothing changes during a quiz night.
13. As a developer, I want the freeze rule in one pure function, so that changing it updates the server and the phone together.
14. As a developer, I want the freeze rule covered by fast pure tests in `shared/types`, so that I don't need Postgres to check an edge case.
15. As a developer, I want one worth formula, so that I never have to choose between "from clue count" and "from points".
16. As a developer, I want the phone to recognise a Clue question by its type through the Question kind registry, so that a new optional field on the question view can't make it guess wrong.
17. As a developer, I want the Answer service's submit path to keep only I/O around the Clue rule, so that the service reads as "load, ask the module, write".
18. As a developer, I want the module to return "frozen" as data, so that each tier reacts in its own way (the server throws `AnswerLockedError`, the phone shows a frozen card).
19. As a developer reviewing a Clue change, I want one file to read, so that I can check the rule without following it across tiers.
20. As a developer running mutation tests, I want the Clue rule to sit in `shared/types`, where Stryker's default run already covers it, so that its mutants are caught without `mutate:db`.

## Implementation Decisions

- **New module in `shared/types`: Clue answer.** It is pure and depends only on the Question kind registry (`hasClues`) and the existing clue-value constants. It works on the minimum question slice: its `type` and its clue count, or its clues, whichever both tiers already hold. The server holds the seeded question with all its clues. The phone holds `type`, `clueCount` and `highestClue` from `QuestionView`.
- **Interface (three operations; the names are for the implementer to choose):**
  - *Clue to record:* takes the question, the stored answer (`{ value, clue } | null`), the new value and the highest clue shown (null means clue 1). It returns either the clue to record (null for any type without clues) or "frozen". It encodes today's rules unchanged:
    - First answer → the highest clue shown.
    - Unchanged value → keeps its stored clue.
    - Changed value whose stored clue is below the highest shown → frozen, unless the stored value is a non-answer (blank or "I don't know").
    - Otherwise → the highest clue shown.
  - *Freeze state:* takes the question, the team's current answer (value and recorded clue, either possibly absent) and the highest clue shown. It returns whether the answer is frozen now and whether it can still freeze (a clue is left to show). The phone uses this in place of its own copy of the rule.
  - *Worth:* what a right answer recorded on a given clue is worth, from the clue count. This is the existing clue-value formula, given its home in the module.
- **The rules match on both tiers.** The phone's "frozen now" must equal "the server would return frozen for any changed non-blank value". The module states this as one rule rather than two functions that happen to agree.
- **The Answer service** stops owning the rule. It loads the stored answer as it does today, calls *clue to record*, throws `AnswerLockedError` on "frozen" (same message, same error type, same socket handling), then grades with `atClue` and the recorded clue as today.
- **Answer views:** `AnswerView.clueValue` and `TeamAnswerView.clueValue` come from the module's *worth*, using the question's clue count. The listing queries already load the question, and its clues are in its payload. `clueValueFromPoints` and its test are deleted. The submit path's `clueValue` (taken today from the graded question's points) uses the same *worth* call.
- **`atClue` in the Scoring module** calls the module's *worth* rather than the clue-value function directly, so the worth formula has one caller-facing home. Its signature is unchanged. (Review candidate 2, the Grading policy owning the graded-as question, is a separate spec. This one doesn't depend on it, and it doesn't block it.)
- **The phone** recognises a Clue question with `QUESTION_KINDS[question.type].hasClues`, not by checking that `highestClue` and `clueCount` are present. The question browser's `clueFreezeOf` is replaced by a call to *freeze state*. The props it renders (`frozenClue`, `isFreezable`) stay the same shape.
- **No schema, protocol or DB change.** The `clue` / `clueValue` fields on the three answer views keep their names, types and meaning. No migration.
- **Glossary:** no new domain term for players or moderators. "Clue answer module" is a code name. If the implementer thinks it is worth a glossary entry next to **Clue question**, add one sentence; otherwise leave `GLOSSARY.md` alone. No `DOCUMENTATION.md` or `/guide` change, since behaviour is unchanged.

## Testing Decisions

- **A good test checks what the rule decides, not how it is coded:** given a question, a stored answer, a value and a highest clue, what is recorded or refused, and what is it worth. No test should reach into module internals or mock the Question kind registry.
- **The main seam is the module's own interface in `shared/types`, tested with Vitest.** These tests take over every freeze and worth case now only covered by Postgres:
  - first answer on clue 1 and on a later clue;
  - unchanged resend after a new clue keeps the old clue;
  - changed value on the same clue is re-recorded;
  - changed value after a new clue is frozen;
  - blank and "I don't know" stored answers never freeze, both before and after a new clue;
  - submitting a blank over a frozen answer is still frozen;
  - a type without clues always records null;
  - a null highest clue is treated as clue 1;
  - freeze state on the last clue: frozen possibly true, can-freeze false;
  - worth on every clue for 2 and 8 clues.

  Prior art: `clue-value.test.ts` and `clue-question.test.ts` in `shared/types/src/__tests__/`.
- **A parity test.** For every case in a small table, *freeze state* reports frozen exactly when *clue to record* refuses a changed non-blank value. This test is what keeps the server and the phone in step.
- **The backend's Postgres spec for Clue answers** (`clue-answers.spec.ts`) stays as the integration check that the service throws `AnswerLockedError`, stores the clue and reports `clueValue`. Its edge cases can shrink to one happy path and one locked path, because the cases now live in the pure tests. Add one case where the stored question's points differ from clues × 0.5: the views must report the worth from the clue count.
- **Phone:** the existing question browser and clue-list tests (Vitest, `apps/frontend/app/play/__tests__/`) keep their assertions on what the team sees: the frozen card and the warning. Their fixtures may need a `type: 'clues'` now that the type is what's checked. No new frontend seam.
- Run `pnpm crap:changed` before committing. The service's submit path should get simpler, not more complex.

## Out of Scope

- Review candidate 2: the Grading policy building the graded-as question (clue value plus wider margin) for every grading event. It's a separate spec. This spec only moves where the worth formula lives.
- Review candidates 3–5 (doubled rounds owning "never doubled", one record per team answer on the phone, collapsing the big-screen view adapters).
- Any change to the Clue rules themselves: worth per clue, the 2–8 clue limits, freeze behaviour, the non-answer exception.
- Merging the phone's `myAnswerClues` map into one record per answer (that's candidate 4).
- Changing the `clueValue` fields on the wire, or dropping them in favour of the phone computing worth itself.

## Further Notes

- The behaviour this spec preserves is the Clue exception described under "Last-write-wins answers" in `CLAUDE.md`'s Known Tradeoffs. Any test that fails after the move points to a real change in behaviour, not a test to update.
- Blocked by the `grading-policy-graded-as` spec (review candidate 2): both rewrite the Answer service's submit path, and it lands first. Once it has, the Grading policy builds the graded-as question through `atClue`, so routing `atClue` through *worth* covers every grading event, and the submit result's `clueValue` already comes from the clue-value function, ready to switch to *worth*.
