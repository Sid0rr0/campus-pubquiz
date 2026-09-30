# 03: Player game hook; /play and the join flow switch over

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** A team's phone gets its own player game hook on the shared connection core. It returns:

- the snapshot, connection error and reconnect timestamp;
- the team, whether the team is linked, and the kicked and session-closed signals;
- the team's own answers, answer grades, bonus awards and seen questions (the seen-questions merge moves over unchanged).

Its actions are join team, submit answer, leave session and submit showdown guess, each returning its acknowledgement result.

What teams notice:

- A rejected join (wrong code, name taken, already registered) shows its reason on the join screen. Resubmitting retries the join, and a later successful join clears the old error.
- A rejected answer (for example, the question already locked) or showdown guess tells the team why without treating the connection as dead.

What stays exactly as today:

- An answer is still refused with the "not connected" toast while the team is unlinked.
- An answer sent over a silently dead socket still forces a fresh connection after the existing timeout, and is resent after the rejoin.
- Answer confirmations still carry the saved answer and any auto-graded points.

The join flow now uses the join result, rather than the connection error, to know that a join finished or was rejected.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [x] Player hook tests, driven through the faked transport, cover:
  - a join rejection reaching the join flow;
  - submit confirmation by acknowledgement;
  - a submit rejection clearing the pending answer and showing its message without reconnecting;
  - a missing acknowledgement within the existing timeout forcing a reconnect and resend after the rejoin;
  - the unlinked "not connected" toast;
  - kicked and session-closed signals;
  - seen questions accumulating across blocks
- [x] The join flow no longer reads the connection error to detect a finished join
- [x] /play and join-flow tests mock the player hook, and the real-socket join-flow test runs against the player hook
- [x] The player hook exposes no admin-only members
- [x] The existing /play test suite passes (answering, reconnect, logout, kicked, session closed, showdown)

## Comments

Implemented in a single commit on `main` (see git history for `feat(frontend): player game hook …`).

- `usePlayerGame` (`apps/frontend/app/lib/use-player-game.ts`) sits on the shared connection core. `useTeamJoin` and so `/play` and the home join panel use it. The old three-role hook stays for /display, /remote and /rules until ticket 06; it now imports the player helpers/types from the new module instead of keeping copies.
- The core gained an internal `forceReconnect` (used by the dead-socket timeout); the admin hook doesn't expose it.
- Join flow: a join result (accepted or rejected) settles the in-flight guard and sets/clears the join error shown on the join screen. The connection error still releases the guard, but only for a refused connection, where no join is ever sent and so no result can arrive.
- Kick notice: the player hook only exposes `kicked`; `useTeamJoin` supplies the "removed from this team" message for the join screen.
- `Status:` left as `ready-for-agent`: the triage vocabulary has no done state.
