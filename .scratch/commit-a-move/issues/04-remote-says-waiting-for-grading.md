# 04: /remote says Advance is waiting for grading

**What to build:** During the break, while the block still has an ungraded answer, the Move plan plans a "grading pending" step for ADVANCE into the reveal, carrying the ungraded question ids. It counts as pressable, so the Advance slot still shows Advance, and pressing it is refused with today's ungraded-answers refusal and its question ids. /remote's "next" line says Advance is waiting for grading, the way it already says "Waiting for every guess" for a showdown. When the last ungraded answer is graded, it switches to the reveal's round title card, and it follows a live answer-key fix that makes an answer ungraded or clears the last one. The plan reads the session's cached ungraded set, which grading-refresh keeps fresh. The press still re-reads the database before the reveal starts, so a stale cache can never let it through.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 01 (Agreement walk pins today's preview against the real press), 03 (The Move plan plans every action, lobby start included), and `.scratch/grading-refresh/` (every grade change, key fix included, keeps the ungraded set fresh)

**Status:** done

- [x] With an ungraded answer in the break, /remote's "next" line says Advance is waiting for grading, and pressing Advance is refused with the ungraded question ids, as today
- [x] Once the moderator grades the last ungraded answer, the "next" line names the reveal's round title card and Advance shows it
- [x] A live answer-key fix in the break that makes an answer ungraded (or clears the last one) updates the "next" line straight away
- [x] The Advance slot still announces Advance while grading is pending
- [x] The refusal still comes from a fresh database read, not the cached set
- [x] The 01 walk's ungraded-break and key-fix exceptions are removed and the walk passes
- [x] The grading gate, ungraded agreement and action-availability specs pass unchanged
- [x] CONTEXT.md's **Move plan** mentions the grading-pending step and the lobby start; DOCUMENTATION.md and the `/guide` page mention the new "waiting for grading" line wherever they describe the presenter preview or the break → reveal gate

## Comments

Implemented as a `grading_pending` Move plan step (`move-plan.util.ts`) that carries the reveal progress, so the press falls through to the existing fresh-database gate in `GameStateService.applyAction`. /remote's line reads "Grading — Waiting for grading". Committed on main; see git history for the hash.
