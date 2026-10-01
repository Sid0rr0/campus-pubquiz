# 06: The presenter preview is a dry-run commit

**What to build:** The Commit-a-move module gains a preview entry point: the same Move plan and Settle step as a commit, with no grading writes, no showdown resolve and nothing saved. /remote's "next" line describes the screen by projecting the session as that dry run leaves it, instead of the current session with only its progress swapped in. Steps that don't move the screen (grading pending, showdown waiting, blocked) are described from the step, as today. The quiz master sees /remote predict exactly the screen the next press puts on air at every point, including moving into a closest_guess reveal, which now previews the sub-step it will really open on.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 05 (One Commit-a-move module carries out every press)

**Status:** ready-for-agent

- [ ] The presenter preview's "next" screen comes from the module's dry run, using the same plan and Settle step as a commit
- [ ] A dry run writes nothing: no grades, no showdown resolve, no saved progress, and the in-memory session is unchanged
- [ ] Every remaining named exception in the 01 agreement walk is removed and the walk passes with none left
- [ ] The presenter context and action-availability specs pass unchanged
