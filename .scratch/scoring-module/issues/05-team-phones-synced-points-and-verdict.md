# 05: Team phones: synced closest_guess points and the verdict

**What to build:** A team's phone shows the points it actually got for a closest_guess question, from its graded answers synced at reveal entry, instead of re-deriving them by looking up its team name in the reveal list. Wherever the phone shows a graded answer, it shows the verdict (correct / partial / incorrect) the quiz master sees. See [spec](../spec.md) user stories 14 and 15.

**Blocked by:** 03

**Status:** done

- [x] Frontend tests: a team's closest_guess points come from its synced graded answer, including when its team name differs from the reveal list's entry (e.g. renamed), and are 0 when another team was closest.
- [x] Frontend tests: the team's answered-questions view labels each graded answer with its verdict, and a partial match answer shows as partial.
- [x] No client code infers correctness by comparing points to the question's points.

## Comments

Implemented in `feat(frontend): team phones read synced points and verdict`. Status set to `done`.

- `buildOpenedQuestions` no longer takes a team name: closest_guess points now come from the same synced graded answer as every other type. A team that never submitted shows 0 once the question is revealed, even when nobody submitted (previously nothing was shown in that case).
- `MyAnswerGrade` and `OpenedQuestionEntry` carry `verdict`; the answered-questions list shows Correct / Partial / Incorrect beside the points.
- Backend: `team-answers-sync.spec.ts` now asserts the reveal-entry sync carries the graded closest_guess points and verdict.
