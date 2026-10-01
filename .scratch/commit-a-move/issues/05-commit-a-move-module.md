# 05: One Commit-a-move module carries out every press

**What to build:** One module carries out a planned press from start to finish, and the action handler, both auto-lock timer paths, session creation and restart restore all go through it. It has two entry points:

- **Commit** a press. Plan it. Refuse blocked, showdown-waiting and grading-pending steps with today's errors and messages. Commit the ephemeral steps (showdown reveal step, with the round resolved and the leaderboard refreshed on the final step; closest_guess sub-step) without touching or saving progress. For steps that move progress, run in order: the database ungraded check at break → reveal_intro, the grading stages, the Settle step with the step kind, and saving progress and the phase timer. Return the new session with its delivery outcome, which now includes the follow-ups `applyAdminAction` adds afterwards today: a fresh leaderboard when the board is turned on, and every connected team named for an answer re-sync on reveal entry.
- **Place** a session at a starting point. Run the break-gated bulk ungraded refresh and the Settle step, for creation (lobby) and restore (saved progress and phase timer). Nothing is saved.

The in-memory session is stored only after its progress has been saved. If saving fails, the press is refused and the session stays where it was. The Live session module's public interface is unchanged. Its action methods become a call into commit plus storing the result. Nothing changes on stage.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 02 (The Settle step knows the step kind), 03 (The Move plan plans every action, lobby start included), 04 (/remote says Advance is waiting for grading)

**Status:** done

- [x] The admin action, both auto-lock timer paths, session creation and restart restore all go through the module; no other place puts the plan → grade → settle → save pipeline together
- [x] Turning the board on still shows every joined team at zero points, and entering the reveal still re-syncs every connected team's answers, now returned in the commit's outcome with no second store write after an await
- [x] When the progress save fails for a press (swap the progress repository's save in the real-store harness), the press is refused and the next snapshot is unchanged
- [x] Restart restore puts the session back at exactly the same point, with phase timers and the ungraded set rebuilt; a new session starts settled in the lobby
- [x] The 01 agreement walk, grading gate, kahoot timer, question-lock auto-advance, showdown, leaderboard, ungraded restore, persistence and session-creation specs pass unchanged
- [x] CONTEXT.md gains **Commit a move** (carrying out one planned press: grade, settle, save), with "apply action" under _Avoid_

## Comments

Implemented as `MoveCommitter` (`apps/backend/src/game/state/commit-a-move.service.ts`) with `commit` and `place`; `GameStateService` constructs it beside `BlockGradingService` and stores what `commit` returns only after the progress save succeeds. `applyAction` stays as a thin delegation to `applyAdminAction` (making it private belongs to a later candidate). The leaderboard refresh on turning the board on now happens inside the commit, before the save; the reveal-entry team sync is computed from the committed session. New `commit-a-move.spec.ts` covers the failed-save refusal (snapshot unchanged, retry works) and the outcome's team sync. Committed on main; see git history for the hash.

Known, accepted: the commit still builds its result from the session it read before its awaits, so a team connecting or an answer landing mid-commit can be overwritten when the result is stored. That window existed before; serialising each session's async writes is review candidate 5 (out of scope in the spec).
