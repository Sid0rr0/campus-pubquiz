# 02: Hand grades and wider-margin purchases become Grading policy events

**What to build:** The last two grading paths that build their own graded-as question in the Answer service move into the Grading policy, using ticket 01's adjustments and graded-as builder. After this ticket, the Answer service has no scoring rule left: it loads data, asks the policy and writes the grade. Teams and the quiz master see the same grades and the same refusals as today.

- **Hand grade (new policy event):** given the question, the stored answer (its grade state and adjustments) and the points the quiz master chose, it returns either the grade write (the verdict judged against the graded-as question, so Correct on a Clue answer at clue 3 is correct at the clue-3 value) or "refused" when the hand-grade rule says no (a batch answer before its batch has run). The service turns "refused" into the existing `AnswerGradeRefusedError` with the same message. The existing hand-grade permission check stays exported for the grading state.
- **Wider margin bought (new policy event):** given the question and the team's stored answer with its adjustments, it returns the grade write: grade against the widened margin, keep a stored grade at or above the new score, and write nothing when the widened margin still misses.
- The Answer service's hand-grade and wider-margin regrade build the adjustments (the stored row's clue and the existing purchase lookup) and call neither `atClue` nor `withWiderMargin`. Their signatures, and so their callers (the gateway and purchases), are unchanged.

No `/guide` or docs text: behaviour is unchanged.

**Blocked by:** 01 (The Grading policy works out the graded-as question for submit, key fix and speed score), which adds the adjustments and the builder and edits the same files.

**Status:** ready-for-agent

- [ ] Policy spec, hand grade: Correct on a Clue answer at a later clue is a correct verdict at that clue's value, less is partial, zero is incorrect; a batch answer before its batch runs is refused; a wider-margin answer is graded through the builder
- [ ] Policy spec, wider margin bought: a higher moderator grade is kept; a lower grade or no grade is replaced; an answer the widened margin still misses gets no write
- [ ] The service's keep-if-higher cases move from the Postgres specs to the policy spec; one Postgres case still shows that buying a wider margin after answering raises the grade
- [ ] Nothing in the Answer service calls `atClue` or `withWiderMargin` (`rg` confirms it)
- [ ] The Postgres-backed Answer service specs pass, and a refused hand grade still surfaces the same error message
- [ ] `pnpm typecheck`, the backend tests and `pnpm crap:changed` pass
