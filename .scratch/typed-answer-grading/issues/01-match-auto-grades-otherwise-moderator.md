# 01: A typed answer that matches the key grades itself; anything else waits for the moderator

**Status:** done

**Blocked by:** None (can start immediately)

**What to build:** Three question types take a typed answer (`inputKind: 'text'`): free_text, audio and youtube. Today they sit at two extremes:

- **free_text** is always graded at submit. A match is marked correct; **anything else is marked incorrect with 0 points and counts as graded** (`scoreBase` in `shared/types/src/scoring.ts`, `gradedAt` set in `AnswerService.submit`). A synonym or near-miss spelling is silently marked wrong and never shows up as needing grading.
- **audio / youtube** are never graded at submit (`gradingMode: 'human'`). Even an answer identical to the key waits for the moderator.

New rule, the same for all three: **a submission that matches the answer key is graded correct automatically. A submission that doesn't match is left ungraded for the moderator.**

"Matches" uses today's free_text comparison (`normalizeFreeText`: trimmed and case-insensitive, so "Queen" / " queen " / "QUEEN" all match). It applies to an audio or youtube answer picked from options too, since the picked option is stored as its text.

### Behaviour

- **Submit, match:** correct, full points, graded at submit. This is new for audio and youtube.
- **Submit, no match:** ungraded (no grading time, no verdict, 0 points). The question shows as ungraded on `/control`, and Advance out of the break is refused until the moderator grades it. This is new for free_text; audio and youtube already behave this way.
- **Revision:** last write wins, as today.
  - The new value matches: graded correct automatically, replacing any earlier grade.
  - The new value doesn't match and differs from the previous value: back to ungraded, even if the moderator had graded the previous value. This is the reset audio and youtube already do in `submit`.
  - The same value is resubmitted: the grade is left alone, so a moderator's grade survives.
- **Moderator grading:** unchanged. The moderator can still override any answer of these types, matching or not.
- **Live answer-key fix** (`BlockGradingService.regradeQuestions`): all three types are re-graded the same way.
  - Answers that match the corrected key are graded correct.
  - A non-matching answer the moderator graded keeps their grade.
  - Any other non-matching answer becomes ungraded, including one that was auto-graded correct under the old key.

  Today audio and youtube are skipped by a key fix (their grades are left alone), and free_text re-scores every answer. How "the moderator graded it" is told apart (compare against the old key, or record how an answer was graded) is the implementer's call.

- **Kahoot:** not affected, since none of the three is allowed in kahoot rounds (ADR 0001 for free_text; audio and youtube have `kahootAllowed: false`).
- **Existing answers:** no data migration. Stored answers keep their current grade, or stay ungraded, until they're resubmitted, graded or re-graded by a key fix.

### Where the rule lives

The project guide says per-type grading knowledge comes from the question type registry (`QUESTION_KINDS`). Give the three types one shared grading mode (for example `'match-or-human'`) in place of free_text's `'auto'` and audio/youtube's `'human'`, so that scoring, `submit`'s reset rule and the key-fix regrade all read it from there. No `type === 'free_text'` / `'audio'` checks in the answer service or grading module.

Code that reads the grading lists today:

- `shared/types/src/scoring.ts`: `AUTO_GRADED_TYPES` / `isAutoGradedType`, `HUMAN_GRADED_TYPES`
- `apps/backend/src/answer/answer.service.ts`: `submit` (scoring and the revision reset) and `regradeAutoGraded`
- `apps/backend/src/game/state/block-grading.service.ts`: `regradeQuestions`, which picks the regrade path by type

### Docs to update in the same commit

- `DOCUMENTATION.md`: the `free_text`, `audio` and `youtube` entries in the question-type list, the paragraph that sorts types into auto-graded and "need the admin's judgment", the revision/grade-cleared note, and the live-edit regrade paragraph
- The `moderatorNote` of free_text, audio and youtube in `shared/types/src/question-kind.ts` (audio and youtube say "either way you grade each answer by hand")
- The `/guide` page (`apps/frontend/app/guide/guide-content.tsx`), wherever it says which answers the moderator grades
- The project guide's "Live answer-key fixes overwrite manual overrides" tradeoff: for these three types the moderator's grade now survives a key fix

### Tests

- Scoring: for each of the three types, a matching submission is correct and a non-matching one has no automatic verdict
- Through the real-store gateway harness:
  - A matching audio answer is graded at submit and never shows as ungraded
  - A wrong free_text answer puts its question on the admin view's ungraded list and blocks Advance out of the break until graded
  - A revision into a match takes the question off the list; a revision into a different non-match puts it back
  - A live key fix on an audio question grades a newly matching answer and keeps the moderator's grades
- Existing specs that submit an audio or youtube answer identical to the key and expect it ungraded need a non-matching value instead. Specs that submit a wrong free_text answer and expect it graded need the same review. Specs that seed audio or youtube questions include `grading.spec.ts` (game and answer), `grading-gate.spec.ts`, `live-edit-regrade.spec.ts`, `submit-and-list.spec.ts`, `state-transitions.spec.ts`, `roster-answer-grading-isolation.spec.ts` and `acknowledgement.spec.ts`.
- `ungraded-agreement.spec.ts` (ungraded-source 01): its audio ('Queen') and youtube ('Jaws') submissions match their keys, and its wrong free_text answer is expected to stay off the list. Update the values and expectations to the new rule so the walk keeps covering a waiting answer of each type and still proves the view and the database agree.

## Acceptance criteria

- [x] A free_text, audio or youtube submission matching the answer key (trimmed, case-insensitive) is graded correct at submit
- [x] A submission of those types that doesn't match is stored ungraded and appears in the admin view's ungraded list
- [x] Advance out of the break is refused while such an answer is ungraded
- [x] Revising into a match auto-grades it; revising into a different non-match resets it to ungraded; resubmitting the same value keeps the grade
- [x] A live answer-key fix on any of the three types grades new matches correct, keeps the moderator's grades, and leaves other non-matches ungraded
- [x] The rule comes from one grading mode in the question type registry, with no type literals in the answer service or grading module
- [x] The agreement walk and the affected grading specs are updated and pass
- [x] `DOCUMENTATION.md`, the three moderator notes, `/guide` and the project guide's tradeoff are updated

## Comments

Implemented in a single commit on `main` (see git history for `feat(backend): typed answers grade themselves on a match`).

- The rule lives in the new `match-or-human` grading mode in `QUESTION_KINDS`; `gradeAtSubmit` (`shared/types/src/scoring.ts`) is the one reader. `HUMAN_GRADED_TYPES` and the `human` mode are gone since no type uses them.
- Key-fix regrade (`AnswerService.regradeMatchOrHuman`) tells a moderator grade from an automatic one by re-running the submit-time grade against the question as it stood before the edit (captured in `GameStateService.quizEdited`), so no schema change or migration. Tradeoff recorded in `CLAUDE.md`.
- Resubmitting the same value to a graded match-or-human answer leaves the grade alone, even when the value matches.
