# 04: The final block's answers survive a reconnect after the quiz ends

**What to build:** A phone that reconnects (or refreshes) after the quiz has ended gets back the final block's correct answers and points in its history, just like a phone that stayed connected through the reveal. Today, at `ended` the final block is in neither `revealQuestions` (`ended` isn't a revealing status) nor `pastRevealedQuestions` (it's still the current block), so a reconnecting phone loses it.

At `ended`, the players view carries the final block's reveal walk as it stood when the quiz ended. It applies ticket 01's trim using the status the quiz ended from (`previousStatus`) in place of the current status, and the stored `revealIndex`:

- **Advancing past the last reveal:** the whole block.
- **End Quiz pressed mid-reveal:** the walk up to that point.
- **End Quiz pressed before the reveal started:** nothing from the final block.

Previous out of `ended` goes back to the normal reveal trim.

Out of scope in the spec (`.scratch/players-reveal-redaction/spec.md`, "The final block after ended"); this ticket picks it up.

**Blocked by:** 01 (it reuses the players reveal trim)

**Status:** done

- [x] At the players projection, at `ended` reached by advancing past the final reveal, every final-block question is carried with its answer.
- [x] At `ended` reached by End Quiz during `reveal` at position k, positions 0..k are carried; during `reveal_intro` at position k, positions 0..k-1 are carried.
- [x] At `ended` reached by End Quiz from a non-revealing status (e.g. `question_open`, `break`), no final-block answers are carried.
- [x] An active showdown at `ended` doesn't change what is carried.
- [x] `/play`: a fresh phone given an `ended` snapshot shows the final block's correct answers and points in its history list.
- [x] `DOCUMENTATION.md` notes that the players view at `ended` keeps the final block's reveal walk.

## Comments

At `ended` the players projection now builds the final block's walk itself (`endedRevealWalk` in `screen-projection.util.ts`): it re-reads the block as it stood under `previousStatus` and applies ticket 01's trim, so advancing past the last reveal carries the whole block, End Quiz mid-`reveal` at k carries 0..k, mid-`reveal_intro` at k carries 0..k-1, and any non-revealing `previousStatus` (or a legacy `null`) carries nothing. The on-air question is carried whole (no closest-guess step trim — nothing is being revealed any more). An active showdown doesn't affect it. No phone change was needed: `mergeSeenQuestions` is status-agnostic, so a fresh phone given the `ended` snapshot lists the answers; tests pin that. The code landed in the commit `feat(backend): a reconnecting phone keeps the final block's answers after the quiz ends`.
