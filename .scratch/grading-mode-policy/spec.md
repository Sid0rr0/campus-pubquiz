# Spec: One Grading policy per grading mode — every grading event decided in one pure module

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-13, candidate 1 ("Put the grading lifecycle in one Grading policy module"). Follows [grading-policy](../grading-policy/spec.md), which listed "moving the per-answer regrade rules into Scoring as pure functions" as out of scope until question answer kinds had landed. It has now landed.

## Problem Statement

The question type registry gives each question type one grading mode (`auto`, `batch`, `match-or-human`). What that mode means for each grading event is decided again, separately, in two backend modules:

- **The answer module checks the grading mode in four places.** Submit keeps the moderator's grade on a same-value resubmit only for match-or-human. Hand grading refuses a batch answer until its batch has run. The key-fix rescore and kahoot speed scoring both return early unless the type is auto.
- **The block grading module checks it in five more.** Which questions can be ungraded, which questions get batch-graded on reaching a graded status, and the key-fix regrade, which is an if/else-if chain over the three modes.
- **The rule for whether an answer was "graded automatically" is split across two methods.** Submit decides when to keep a grade. The match-or-human key-fix regrade infers "graded automatically" by re-running the submit-time grade against the key as it was before the fix. Both describe one invariant, and they have to agree. The project guide's accepted tradeoff "Live answer-key fixes overwrite manual overrides" has no single module that implements it.
- **The only way to test these rules is through Postgres.** The answer module's grading spec calls five separate regrade methods 33 times, row by row against a real database. The block grading module has no spec of its own. Nowhere is the full table of grading mode × grading event written down.

None of this is broken today. The cost shows when a question type or grading rule changes: the `number` type had to check each of these places, and the review fix for it added another special case.

## Solution

A pure **Grading policy** module, with one entry per grading mode, decides every grading event. Given the question (plus, for a key fix, the question as it was before the fix) and the stored grades of its answers, it returns the grade writes: set a grade, clear it back to ungraded, or keep it.

The answer module becomes a persistence adapter around it. It reads a question's answer rows, asks the policy, and writes what the policy returns. The block grading module asks the policy which questions can be ungraded and which grade at the lock. It stops dispatching by grading mode, and its key-fix regrade becomes one call per corrected question.

Nothing changes on stage, on the phones, in the socket contract or in the database. Every answer grades exactly as it does today.

## User Stories

1. As a team submitting an answer to an auto-graded question (multiple choice, sort, match, number), I want it scored the moment it lands, as today, so that my phone shows my verdict straight away.
2. As a team revising an auto-graded answer before the lock, I want it rescored against the new value, as today.
3. As a team submitting a typed answer (free text, audio, YouTube) that matches the key, I want it graded correct automatically, as today.
4. As a team submitting a typed answer that doesn't match the key, I want it to wait for the quiz master, as today.
5. As a team revising a typed answer into a different value, I want any grade given to my old value cleared, as today, so that the quiz master grades what I actually submitted.
6. As a team resubmitting exactly the same typed answer, I want the quiz master's grade on it kept, as today.
7. As a team submitting a closest_guess answer, I want it left ungraded until the lock, as today, because nobody knows who's closest until every guess is in.
8. As a quiz master, I want to override any automatic grade by hand, as today.
9. As a quiz master, I want hand grading of a closest_guess answer refused until its batch has run at the lock, as today, so that the batch can't overwrite my grade.
10. As a quiz master, I want closest_guess questions graded in one batch when the block reaches a graded status, as today.
11. As a quiz master restarting the backend after the lock, I want the closest_guess batch not to run again, as today, so that my overrides survive.
12. As a quiz master running a kahoot round, I want the just-locked question's points scaled by each team's stored response time, as today.
13. As a quiz master stepping back with Previous into a locking kahoot question and advancing again, I want the speed scaling to give the same points, as today.
14. As a quiz master fixing an auto-graded question's key mid-quiz, I want every answer to it rescored against the corrected key, with kahoot speed scaling re-applied, as today.
15. As a quiz master fixing an auto-graded question's key, I want my per-answer overrides overwritten, as the project guide's accepted tradeoff describes, so that I re-override in the break if needed.
16. As a quiz master fixing a typed question's key, I want an answer that now matches graded correct, as today.
17. As a quiz master fixing a typed question's key, I want my grade on a non-matching answer kept, as today.
18. As a quiz master fixing a typed question's key, I want an answer that was only graded automatically, and no longer matches, to go back to ungraded, as today.
19. As a quiz master who confirmed an automatic grade by grading it identically by hand, I want a key fix that no longer matches to clear it, as the project guide's accepted tradeoff describes.
20. As a quiz master fixing a closest_guess key after its batch ran, I want the batch re-run and the reveal summary updated, as today.
21. As a quiz master fixing a closest_guess key before the lock, I want nothing regraded, as today, so that the lock grades it with the new key.
22. As a quiz master, I want closest_guess never to show as ungraded, and never to hold the quiz in the break, as today.
23. As a quiz master, I want `/control`'s ungraded markers, the break gate and the leaderboard to come out exactly as today after every grading event.
24. As a developer changing how a grading mode behaves on one event, I want to change one entry in one module, so that the rule and its test sit together.
25. As a developer adding a question type, I want to pick a grading mode in the registry and get every grading event right without touching the answer or block grading modules.
26. As a developer, I want the "graded automatically" rule written once, so that submit and the key-fix regrade can't disagree.
27. As a developer, I want the whole grading mode × grading event table as one fast test with no database, so that I can read the rules off it.
28. As a developer reading the answer module, I want it to read as "read rows, ask the policy, write rows", so that persistence and grading rules don't interleave.
29. As a developer reading the block grading module, I want its key-fix regrade to be one call per question with no grading-mode branches, so that it only does session bookkeeping.

## Implementation Decisions

- **New module: the Grading policy.** It is pure: no Nest, no database, no session. It lives in the backend answer module, because the stored grade it reasons about (points, verdict, graded-or-not, the stored value and response time) is backend storage. It builds on Scoring for every score: `gradeAtSubmit`, `scoreSubmission`, `gradeClosestGuessBatch` and `verdictForManualGrade` stay where they are. The policy decides _when_ and _whether_ a score is written, and Scoring decides _what_ the score is.
- **The policy is keyed by grading mode, read from the registry entry.** It is a `Record<GradingMode, …>`, so a new grading mode fails typecheck until every event has an answer. Nothing outside the policy needs to branch on grading mode for grading purposes, and no `.type === '<literal>'` checks are added (CODING_STANDARDS lint rule).
- **The policy answers these grading events:**
  - _submit_: given the question, the submitted value and the stored grade for this team (if any), it returns set, clear or keep. Today's rules carry over unchanged: an auto score always sets; a match-or-human same-value resubmit with a grade keeps it; a revision with no automatic score clears; a first submission with no automatic score is stored ungraded.
  - _can grade by hand_: given the question and the stored grade, it returns whether a hand grade is allowed. Batch answers are allowed only once graded.
  - _grades at the lock_: whether the question is graded in one batch when its block reaches a graded status. Given the stored rows, it returns the batch writes, or nothing if any row shows the batch already ran.
  - _speed score_: given the question, its rows and the kahoot timer, it returns rescored writes for auto questions and nothing for the others.
  - _key fix_: given the corrected question, the question before the fix, its rows, the kahoot timer (or none) and whether the batch has already run, it returns the writes plus whether the question was rescored at all. Per mode: auto rescores every row (speed-scaled when a timer is given); match-or-human sets a newly matching row correct, clears a row that was graded automatically and no longer matches, and keeps every other row; batch re-runs only when the batch has already run.
  - _can be ungraded_: false for batch, true otherwise. This replaces the block grading module's exported `canBeUngraded`, and both the Grading refresh and the reveal gate read it.
- **"Graded automatically" is one private rule inside the policy**: a stored grade equal to what the submit-time grade gives against a given key. Submit's keep rule and the key-fix clear rule both use it. Today's behaviour is preserved, including the accepted case where a moderator grade identical to the automatic grade counts as automatic.
- **Writes are values, not mutations.** The policy returns a write per row: set with points and verdict, clear, or keep. It never touches entities. The answer module applies the writes, stamping the grading time once per flush as today, and treats keep as a no-op.
- **The answer module's interface narrows.** `submit`, `grade`, `listForQuestion`, `listForTeam` and `listUngradedQuestionIds` stay. The five regrade and batch methods collapse to three:
  - grade at the lock (ensure the batch ran, then return the answers);
  - speed score at the lock;
  - regrade for a key fix (returns whether the question was rescored and its answers).

  Each reads the question's rows, asks the policy and writes the result. None of them checks the grading mode.

- **The block grading module stops dispatching by grading mode.** `regradeQuestions` becomes one regrade-for-a-key-fix call per corrected question. It passes "has the batch run" from whether the session holds that question's closest*guess summary (as today), and recomputes the summary from the returned answers when one is held. Picking the questions to batch-grade on entering a graded status asks the policy's \_grades at the lock*. The "can be ungraded" filter calls the policy. The Grading refresh, `gradesChanged`, `regradeForKeyFix`'s return shape and the Commit a move steps are unchanged.
- **No behaviour, wire, schema or migration change.** Same grades, same outcomes, same order of delivery. The registry entries are untouched, so ADRs 0001 and 0003 are unaffected.
- **Docs, in the same change:**
  - `GLOSSARY.md`: add **Grading policy**. Suggested wording: "the one rule set for what each grading mode does on each grading event: submit, hand grade, lock, kahoot speed scoring, key fix". Avoid: grading rules, grading service.
  - `CODING_STANDARDS.md`: in "Question types are defined once", name the Grading policy as the place grading-mode behaviour lives, next to the `scoring.ts` helpers.
  - `docs/architecture.md`: if a diagram shows the block grading module dispatching regrades by type to the answer module, redraw it as one call through the policy.
  - `DOCUMENTATION.md` and the `/guide` page need no change, since no behaviour changes.

## Testing Decisions

- **Two seams: the answer module's interface against real Postgres, and the Grading policy's interface as a pure table.** A good test asserts what a grading event leaves stored: points, verdict, graded or ungraded. It never asserts which internal method produced it. The real-store gateway specs stay as the end-to-end check and must pass unchanged.
- **New: a Grading policy table spec.** One Jest spec with no database and no Nest. Its rows are grading mode × grading event, with the stored-grade cases each event depends on:
  - submit: first submit, same value graded, same value ungraded, changed value;
  - key fix: matching now, graded automatically under the old key, moderator grade, moderator grade identical to the automatic one, batch run and not run, kahoot timer and none;
  - hand grade: batch before and after the batch;
  - lock: batch already ran;
  - can be ungraded.

  Build the rows from registry types (one per grading mode, at least), so that adding a question type needs no new test. This table is where the rules can be read.

- **Rewrite: the answer module's grading specs onto the narrower interface.** `grading.spec.ts` (33 direct calls to the regrade and batch methods), `auto-grading.spec.ts` and `verdict.spec.ts` move to the three remaining calls, keeping every scenario and expected row. Change only what each test calls, never what it expects. If an expectation would have to change, the refactor changed behaviour.
- **Regression net that must pass unchanged:** `live-edit-regrade.spec.ts` (per type, kahoot before and after the lock, closest_guess before and after grading), `quiz-edited.spec.ts`, `ungraded-agreement.spec.ts`, the kahoot scoring and grading-gate specs, and `submit-and-list.spec.ts`.
- **A gap to pin first, against today's code, so it passes before and after:** an auto-graded answer (e.g. match) whose grade the quiz master overrode by hand, then resubmitted by the team with the same value. Today it is rescored, and the override is lost, because only match-or-human keeps the grade on a same-value resubmit. Pin today's behaviour in the answer module's grading spec, so the policy can't change it silently. Whether that is the right behaviour is a separate question (see Further Notes).
- **Prior art:** the shared Scoring tables (`scoring.test.ts`, `number-question-margin.test.ts`) for a pure per-type table test; `answer-service-test-utils.ts` and `grading.spec.ts` for real-Postgres answer setups; `live-edit-regrade.spec.ts` for per-type key-fix setups through the gateway.

## Out of Scope

- Changing what any grading event does to grades. The project guide's accepted tradeoffs stand.
- An Answer key value (review candidate 2: one value for answer, points and per-type settings, with defaults applied once). The policy takes today's `ScoredQuestion`, and candidate 2 can replace that input later without touching the policy's shape.
- One entry point per move in the block grading module (review candidate 5: callers call speed scoring, the batch and the refresh in order). That becomes easier after this change, but it is a separate change to the Commit a move steps.
- Building the real-store harness from the Nest module (review candidate 3).
- Moving the Grading policy into shared. Only the backend reasons about stored grades.
- Grading attribution (`gradedBy`). Accepted tradeoff.

## Further Notes

- **An open question this spec deliberately doesn't answer:** should a same-value resubmit to an auto-graded question keep the quiz master's override, the way match-or-human does? Today it doesn't. Once the policy exists, changing that is a one-entry change plus one table row. Raise it as its own ticket if wanted.
- **Lint:** the policy reads `gradingMode` from the registry entry rather than calling `isAutoGradedType` and friends. Once the answer and block grading modules no longer call those helpers, check whether any non-test caller is left. If none is, they can stay for the frontend's uses but shouldn't come back into the backend grading path.
- **Overlap:** none with open specs. The grading-policy, live-edit-save and question-answer-kinds specs this one builds on are all done.
