# Spec: The Grading policy decides the graded-as question itself

Status: ready-for-agent

Source: architecture review 2026-11-10, candidate 2 ("The Grading policy decides the graded-as question itself", the review's top recommendation).

## Problem Statement

What an answer scores depends on the question's key and on two things about the answer itself:

- **Clue:** a **Clue question** answer is graded at the value of the clue it was recorded on.
- **Wider margin:** a team that bought a **Wider margin** is graded against the widened margin.

Combine those with the key and you get the *graded-as question*: the question as this one answer is graded against.

Today the caller builds the graded-as question on some grading events, and the Grading policy builds it on others. Each event also applies a different subset of the two adjustments:

| Grading event          | Applies the clue | Applies the wider margin | Built by       |
| ---------------------- | ---------------- | ------------------------ | -------------- |
| submit                 | yes              | yes                      | Answer service |
| hand grade             | yes              | no                       | Answer service |
| key fix (match-or-human) | yes            | no                       | Grading policy |
| key fix (auto)         | no               | yes                      | Grading policy |
| wider-margin regrade   | no               | yes                      | Answer service |
| speed score            | no               | yes (shared auto path)   | Grading policy |

Every cell is correct today only because the Clue question is graded match-or-human and takes no power-ups. That isn't a rule anything enforces. Give a new question type clues and auto grading, or let a power-up work on a Clue question, and some events will score its answers against the wrong question, usually only during a live key fix or at the quickfire lock. In effect "what does this answer score" is spread across the Answer service and the Grading policy, and every new event or adjustment means checking each caller by hand.

For a team the risk is a wrong score shown on the big screen with nothing in the logs. For a developer it means the policy's unit tests can't vouch for grading on their own, because half the rule lives in the service.

## Solution

The Grading policy takes the answer's adjustments (its clue and whether its team bought a wider margin) on **every** grading event, and builds the graded-as question itself, in one place. The Answer service does only I/O. It loads the rows, the clue and the wider-margin purchases, hands them to the policy, and writes the grade the policy returns.

Every score teams, the quiz master and the big screen see stays exactly the same. What changes is that the "Applies" columns above become "always" on every event, and the policy's tests cover all of them.

## User Stories

1. As a team, I want my Clue answer graded at its recorded clue's value on every grading event (submit, hand grade, key fix, speed score), so that no event can hand me the first-clue points or less.
2. As a team that bought a wider margin, I want every grading event to grade my answer against the widened margin, so that a live key fix or the quickfire lock never quietly takes the power-up's benefit away.
3. As a team, I want a live answer-key fix to re-score my answer against exactly the question I'd have been graded against at submit, so that a fix changes only what the fix changed.
4. As a team, I want a wider margin bought after I answered to raise my grade only when the widened margin scores higher, so that a moderator's higher mark is never lowered.
5. As a team, I want my score unchanged by this refactor, so that nothing about a quiz night changes.
6. As a quiz master, I want Correct on a Clue answer to record a correct verdict at that answer's clue value, so that the verdict matches what the answer was worth.
7. As a quiz master, I want a hand grade refused for a batch answer before its block locks, exactly as today, so that the batch still owns closest-guess grading.
8. As a quiz master fixing an answer key live, I want the policy's "was this graded automatically" check to compare against the same graded-as question the answer was first graded on, so that my own grades survive a key fix whenever the documented tradeoff says they should.
9. As a developer, I want one function in the Grading policy that builds the graded-as question from the key and the adjustments, so that adding an adjustment touches one place.
10. As a developer, I want every grading event's input to require the adjustments, so that typecheck catches a new event or caller that forgets them.
11. As a developer, I want the Answer service's grading methods to load, ask and write without calling `atClue` or `withWiderMargin` themselves, so that the service has no scoring rule in it.
12. As a developer, I want the "keep a higher moderator grade" rule for a wider-margin purchase to live in the policy, so that it's unit-tested without Postgres.
13. As a developer, I want the policy's pure Jest spec to cover every adjustment on every event, so that the policy's tests alone prove an answer is scored correctly.
14. As a developer adding a power-up that changes the key, I want to add it in one place (the adjustments and the graded-as builder), so that I don't have to audit five service methods.
15. As a developer giving clues to a new auto-graded type, I want key fix and speed score to apply its clue already, so that the new type is correct from day one.
16. As a developer, I want the Answer service's interface to its callers (gateway, block grading, purchases, live edit) unchanged, so that this refactor stays inside the answer module.
17. As a developer running mutation tests, I want the grading-adjustment logic in the policy, which the backend's DB-free Stryker slice already covers, so that its mutants are killed without `mutate:db`.

## Implementation Decisions

- **The adjustments become one input shape.** The policy defines what an answer brings to grading beyond its value: its recorded clue (null for types without clues) and whether its team bought a wider margin on the question. Both fields are **required**, not optional, on every input that carries a stored or submitted answer. Today's key-fix row has them as optional; they become required, so every caller has to supply them.
- **One private graded-as builder in the policy.** From the key and the adjustments it returns the question this answer is graded against: the clue's value via Scoring's `atClue`, then the widened margin via `withWiderMargin` when the team bought one. Every event below goes through it; no other code calls `atClue` or `withWiderMargin` to grade.
- **Every grading event takes the adjustments:**
  - **Grade at submit / submit:** take the adjustments with the value and the stored answer. The bare-key grade at submit also takes them, so no exported function grades without them.
  - **Hand grade (new policy event):** given the question, the stored answer (its grade state and adjustments) and the points the quiz master chose, it returns either the grade write (the verdict judged against the graded-as question) or "refused" when the hand-grade rule says no. The service turns "refused" into the existing `AnswerGradeRefusedError` with the same message. The existing hand-grade-permission check stays exported for the grading state.
  - **Key fix:** applies the adjustments in every grading mode. Auto now applies the clue too, and match-or-human the wider margin too. The "graded automatically" check compares the stored grade against the graded-as question built from the previous key.
  - **Wider-margin bought (new policy event):** given the question and the team's stored answer with its adjustments, it returns the grade write. It grades against the widened margin and keeps a stored grade that is at or above the new score. That rule moves out of the Answer service unchanged.
  - **Speed score:** its rows carry the adjustments, and the auto rescore applies both through the builder.
  - **Grade at the lock (closest-guess batch):** unchanged. The batch compares guesses across the whole question, and closest-guess answers carry no clue and take no wider margin. It takes no adjustments.
- **The Answer service supplies adjustments everywhere it grades.** It already builds key-fix and speed-score rows with both fields. Submit, hand grade and wider-margin regrade now build the same shape:
  - *the clue:* from the submission's recorded clue, or from the stored row;
  - *the wider-margin flag:* from the existing per-question purchase lookup.

  The service keeps working out which clue a submission is recorded on (or that it is locked). Moving that into a shared module is the `clue-answer-module` spec.
- **The submit result's clue worth** (`clueValue`), which today is read off the service's own graded-as question, comes from the shared clue-value function with the recorded clue. The `clue-answer-module` spec then routes it through its *worth* operation.
- **Unchanged public surface:** the Answer service's method signatures and the `GradeWrite` shape stay the same, and so do the socket payloads, the database and the protocol. No migration. No `DOCUMENTATION.md`, `GLOSSARY.md` or `/guide` change, because no behaviour changes.

## Testing Decisions

- **A good test feeds the policy a question, an answer and its adjustments, and asserts the grade write.** It doesn't check how the graded-as question is built, and it doesn't mock Scoring.
- **One seam: the Grading policy's pure Jest spec** (no Nest, no database), which already has one section per event. Each event gains:
  - a Clue answer recorded on a later clue, graded at that clue's value;
  - a wider-margin answer outside the plain margin but inside the widened one, graded correct.

  Specifically:
  - Submit and grade at submit, both adjustments.
  - Hand grade:
    - Correct on a Clue answer at clue 3 is a correct verdict at the clue-3 value; less is partial.
    - A batch answer before its batch runs is refused.
  - Key fix:
    - For both auto and match-or-human, both adjustments are applied.
    - A moderator grade on a wider-margin answer that equals the widened automatic grade counts as automatic. This is the documented tradeoff, now evaluated against the right question.
  - Wider-margin bought: a higher moderator grade is kept; a lower one or no grade is replaced; an answer the widened margin still misses gets no write.
  - Speed score: both adjustments on an auto row.

  Use test question fixtures with an auto type that has clues where needed, or build the scenario from existing types if the registry makes that impossible. The point is to prove the builder runs on every event, not to depend on today's registry flags.
- **Existing tests need their fixtures updated:** current submit and grade-at-submit cases pass "no adjustments" (no clue, no wider margin) and their expectations don't change.
- **The Postgres-backed Answer service specs** (grading, auto grading, Clue answers, submit and list) are the integration check. They must pass unchanged, which is the evidence that no score changed. Move the service's wider-margin keep-if-higher cases into the policy spec. Keep one Postgres case that buying a wider margin after answering raises the grade.
- Run `pnpm crap:changed` before committing. The service's grading methods should get simpler; check that the policy's new events stay under the CRAP limit.

## Out of Scope

- Moving the Clue freeze rule and the worth formula into a shared module: the `clue-answer-module` spec, which follows this one.
- The closest-guess batch taking adjustments.
- Recording who graded an answer (the accepted "Grading isn't attributed" tradeoff).
- Refunding power-ups after a key fix (the accepted "A key fix after a power-up refunds nothing" tradeoff).
- Changing any grading rule, any grading mode's behaviour, or which question types take which power-ups.
- Review candidates 3–5.

## Further Notes

- The "Live answer-key fixes overwrite manual overrides" tradeoff in `CLAUDE.md` describes "graded automatically" as re-running the submit-time grade against the pre-edit key. After this spec that grade is built from the same graded-as question as submit, which is what the tradeoff already assumes. Its wording doesn't need to change.
- Both this spec and `clue-answer-module` rewrite the Answer service's submit path. This one goes first (the review recommends that order), so `clue-answer-module` is blocked by it in the overview.
