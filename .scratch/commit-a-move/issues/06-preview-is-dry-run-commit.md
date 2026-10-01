# 06: The presenter preview is a dry-run commit

**What to build:** The Commit-a-move module gains a preview entry point: the same Move plan and Settle step as a commit, with no grading writes, no showdown resolve and nothing saved. /remote's "next" line describes the screen by projecting the session as that dry run leaves it, instead of the current session with only its progress swapped in. Steps that don't move the screen (grading pending, showdown waiting, blocked) are described from the step, as today. The quiz master sees /remote predict exactly the screen the next press puts on air at every point, including moving into a closest_guess reveal, which now previews the sub-step it will really open on.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 05 (One Commit-a-move module carries out every press)

**Status:** done

- [x] The presenter preview's "next" screen comes from the module's dry run, using the same plan and Settle step as a commit
- [x] A dry run writes nothing: no grades, no showdown resolve, no saved progress, and the in-memory session is unchanged
- [x] Every remaining named exception in the 01 agreement walk is removed and the walk passes with none left
- [x] The presenter context and action-availability specs pass unchanged

## Comments

Added `previewMove` beside `MoveCommitter` (`apps/backend/src/game/state/commit-a-move.service.ts`): the same `planMove` and Settle step as a commit (shared `settleMove`), with the grading stages, showdown resolve and save left out. `describeNextScreen` now asks `nextPressAction` (new in the Move plan, replacing the lobby special case) and projects the previewed session. The walk in `presenter-context.spec.ts` already had no named exceptions left after 05 and still passes with none; `commit-a-move.spec.ts` gains a spec that the preview saves nothing and leaves the snapshot unchanged. Committed on main; see git history for the hash.
