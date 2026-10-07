# 02: "Grades changed" returns the updated session

**What to build:** Every change to grades during a live session ends through one call on the block grading module. It takes a session and the questions whose grades just changed, and returns the session with the Grading refresh already applied. A caller can no longer read the refresh and forget to apply it, or apply it to a different session.

- Submitting, revising and grading an answer (the Live session module's answer change) call *grades changed*, then add the question's answered-team ids to the result. The answer change's outcome is unchanged.
- The Grading refresh's read and apply halves become private to the block grading module. The apply helper moves out of the session updates module and into the block grading module, and the refresh's result type stops being exported. There is still exactly one way to write the ungraded set.
- The steps inside the block grading module (the closest_guess batch, kahoot speed scoring, and the bulk refresh on entering the break and on restore) use the private halves. Their interfaces to Commit a move are unchanged. The bulk refresh still replaces the set outright.
- The key fix still calls the read half for now. Either keep a temporary public path for it, or route it through *grades changed*, whichever leaves less for ticket 03 to undo.

Reading the refresh and returning the applied session in one call is safe: every grade change runs inside the Session write, one at a time per session.

Parent spec: `.scratch/grading-policy/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The block grading module exposes *grades changed* `(session, questionIds) → session`, which refreshes only the current block's questions, as today.
- [ ] The answer change uses it. Nothing outside the block grading module calls the apply helper.
- [ ] Nothing on stage, on the phones or in the socket contract changes. The ungraded agreement walk, answer recorded and graded, admin flags, ungraded restore, kahoot scoring and grading gate specs pass unchanged.
- [ ] `pnpm typecheck` and the backend suite pass.
