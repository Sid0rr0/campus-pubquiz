# 04: The final block's answers survive a reconnect after the quiz ends

**What to build:** A phone that reconnects (or refreshes) after the quiz has ended gets back the final block's correct answers and points in its history, just like a phone that stayed connected through the reveal. Today, at `ended` the final block is in neither `revealQuestions` (`ended` isn't a revealing status) nor `pastRevealedQuestions` (it's still the current block), so a reconnecting phone loses it.

At `ended`, the players view carries the final block's reveal walk as it stood when the quiz ended. It applies ticket 01's trim using the status the quiz ended from (`previousStatus`) in place of the current status, and the stored `revealIndex`:

- **Advancing past the last reveal:** the whole block.
- **End Quiz pressed mid-reveal:** the walk up to that point.
- **End Quiz pressed before the reveal started:** nothing from the final block.

Previous out of `ended` goes back to the normal reveal trim.

Out of scope in the spec (`.scratch/players-reveal-redaction/spec.md`, "The final block after ended"); this ticket picks it up.

**Blocked by:** 01 (it reuses the players reveal trim)

**Status:** ready-for-agent

- [ ] At the players projection, at `ended` reached by advancing past the final reveal, every final-block question is carried with its answer.
- [ ] At `ended` reached by End Quiz during `reveal` at position k, positions 0..k are carried; during `reveal_intro` at position k, positions 0..k-1 are carried.
- [ ] At `ended` reached by End Quiz from a non-revealing status (e.g. `question_open`, `break`), no final-block answers are carried.
- [ ] An active showdown at `ended` doesn't change what is carried.
- [ ] `/play`: a fresh phone given an `ended` snapshot shows the final block's correct answers and points in its history list.
- [ ] `DOCUMENTATION.md` notes that the players view at `ended` keeps the final block's reveal walk.
