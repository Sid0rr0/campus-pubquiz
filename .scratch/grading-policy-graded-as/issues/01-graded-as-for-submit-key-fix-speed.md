# 01: The Grading policy works out the graded-as question for submit, key fix and speed score

**What to build:** The Grading policy becomes the one place that turns a question's key into the question a single answer is graded against (its *graded-as question*). Here it covers the submit, key-fix and speed-score events. Every score a team, the quiz master or the big screen sees stays exactly the same.

- **Adjustments:** what an answer brings to grading beyond its value: its recorded clue (null for types without clues) and whether its team bought a **Wider margin** on the question. Both fields are required on every policy input that carries an answer; the key-fix row's optional fields become required.
- **Graded-as builder (private to the policy):** from the key and the adjustments, it applies the clue's value (Scoring's `atClue`), then the widened margin (`withWiderMargin`) when the team bought one.
- **Submit and grade at submit** take the adjustments and grade the graded-as question. No exported function grades without them.
- **Key fix** applies the adjustments in every grading mode (auto now applies the clue, match-or-human the wider margin). Its "graded automatically" check compares against the graded-as question built from the previous key.
- **Speed score** rows carry the adjustments, and the auto rescore goes through the builder.
- **The Answer service's submit path** builds the adjustments (its recorded clue and the existing wider-margin purchase lookup) and no longer calls `atClue` or `withWiderMargin`. The submit result's `clueValue` comes from the shared clue-value function with the recorded clue.
- **Unchanged:** the closest-guess batch at the lock, the Answer service's method signatures, `GradeWrite`, the payloads and the database.

Hand grade and the wider-margin regrade are ticket 02. No `/guide` or docs text: behaviour is unchanged.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The policy's pure Jest spec covers, for submit, grade at submit, key fix (auto and match-or-human) and speed score: a Clue answer on a later clue graded at that clue's value, and a wider-margin answer outside the plain margin but inside the widened one graded correct. Build the scenario from fixtures if no registered type has both clues and auto grading; the point is that the builder runs on every event
- [ ] A key-fix case shows that a moderator grade equal to the widened automatic grade counts as automatic (the documented tradeoff, evaluated against the graded-as question)
- [ ] Existing policy cases pass with "no adjustments" and unchanged expectations
- [ ] The Answer service's submit path calls neither `atClue` nor `withWiderMargin`
- [ ] The Postgres-backed Answer service specs pass unchanged
- [ ] `pnpm typecheck`, the backend tests and `pnpm crap:changed` pass
