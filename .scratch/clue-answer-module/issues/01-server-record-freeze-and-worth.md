# 01: Clue answer module owns record/freeze and worth on the server

**What to build:** A pure **Clue answer** module in `shared/types` becomes the one home of two Clue rules, and the server uses it. Nothing a team, the quiz master or the big screen sees changes.

- **Clue to record:** given the question, the stored answer (value and recorded clue, or none), the new value and the highest clue shown (none means clue 1), it returns the clue this write records (null for a type without clues) or "frozen". Today's rules, unchanged: a first answer takes the highest clue shown; an unchanged value keeps its clue; a changed value whose stored clue is below the highest shown is frozen unless the stored value is a blank or "I don't know"; anything else takes the highest clue shown. It returns "frozen" as data and never throws.
- **Worth:** what a right answer recorded on a clue is worth, from the clue count (the existing clue-value formula, moved behind the module).
- The Answer service's submit path keeps only I/O: it loads the stored answer, asks clue to record, throws the same `AnswerLockedError` on "frozen", then grades as today.
- Every answer view's `clueValue` (admin `AnswerView`, `TeamAnswerView`, the submit result) comes from worth with the question's clue count. `clueValueFromPoints` and its test are deleted. `atClue` in the Scoring module calls worth; its signature is unchanged.

Ticket 02 adds the phone's freeze state to the same module. No `/guide` or docs text: behaviour is unchanged.

**Blocked by:** the `grading-policy-graded-as` spec (all its tickets), which rewrites the same submit path first.

**Status:** ready-for-agent

- [ ] Pure Vitest tests in `shared/types` cover: first answer on clue 1 and on a later clue; an unchanged resend after a new clue keeps the old clue; a changed value on the same clue is re-recorded; a changed value after a new clue is frozen; a stored blank or "I don't know" never freezes, before or after a new clue; a blank sent over a frozen answer is still frozen; a type without clues records null; a missing highest clue reads as clue 1; worth on every clue for 2 and 8 clues
- [ ] The Answer service no longer contains the freeze rule; a frozen resubmission still throws `AnswerLockedError` with the same message
- [ ] `clueValueFromPoints` no longer exists (`rg clueValueFromPoints` finds nothing)
- [ ] The Postgres Clue answers spec is trimmed to one accepted and one locked case, plus a new case where the stored question's points differ from clues × 0.5 and the views still report the worth from the clue count
- [ ] `pnpm typecheck`, the backend and `shared/types` tests, and `pnpm crap:changed` pass
