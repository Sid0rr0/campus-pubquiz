# 02: One shared function for the admin controls, used by /control and /remote

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The quiz master's "can I / should I show" controls are computed once, so /control and /remote can't drift apart. Today /control and /remote each compute replay media, answer status and the leaderboard reveal step count with word-for-word copies, and /remote's comment points back at /control's.

One pure function takes the admin view and returns the presentational controls: can start, can end, can close the session, can replay media, show answer status, leaderboard reveal step count, and the names of the teams tied for first. It reads only the admin view, never the REST quiz list, so /remote (which doesn't fetch the quiz list) uses it without special cases. /control and /remote both call it in place of their own copies.

This is the prefactor that makes the Control panel (ticket 03) small. The quiz master sees no change on either page.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] One pure function computes the seven presentational controls from the admin view alone
- [x] /control and /remote both use it, and their own copies of these derivations are deleted
- [x] The function is covered through the page tests, not with unit tests of its own
- [x] Existing /control and /remote page tests pass unchanged in behaviour (replay media, answered ticks, leaderboard steps, start/end/close)

## Comments

Implemented in the commit titled `refactor(frontend): one shared admin controls function for /control and /remote` (find it with `git log --grep`; hash not recorded here to avoid a follow-up commit).

- `getAdminControls` lives in `apps/frontend/app/control/admin-controls.ts`; it reads only the admin view. The Control panel names from the spec map to `AdminControls` (`leaderboardStepCount` is the reveal step count).
- /control and /remote no longer compute replay media, answer status, reveal steps, start/end/close or tied-team names themselves. /remote only uses the subset it shows.
- No unit tests of its own, per the ticket; /control and /remote page tests pass unchanged (25 files, 196 tests).
- `Status:` left as `ready-for-agent`: the triage vocabulary has no "done" state.
