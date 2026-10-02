# 01: Bonus changes go through one session write that ends with fresh standings

**What to build:** When the quiz master awards, edits or deletes bonuses in quick succession, the leaderboard ends up showing all of them and never goes back to older totals. Today each bonus change fetches standings and then applies them. If an older fetch finishes after a newer one, the older standings land last.

This ticket introduces the **session write** in the Live session module and moves bonus changed onto it. The session write is a per-join-code, in-memory queue: each change runs against the session as the previous write left it, reads standings once as its last step, and stores the result. Writes to different sessions don't wait for each other. A write that throws stores nothing, still passes the error to its caller, and doesn't block the next write. Writes can declare that they don't change scores and skip the standings read. Refreshing is the default. Bonus changed stops fetching standings itself. The BONUS_AWARDED notice is unchanged.

It also adds a helper to the real-store gateway harness that holds a database-facing call open (a deferred promise on the standings read, the progress save or the answer save) and releases it later, so specs can force two events to overlap.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Written first, failing against today's code: two bonus awards for one team, with the first award's standings read held until the second finishes. The final admin snapshot's leaderboard reflects both, and no snapshot after the second award shows the first award's older totals.
- [x] Two sessions: holding one session's bonus write doesn't delay a bonus write in the other session.
- [x] A bonus write that fails (the standings read rejects once) leaves the session unchanged, returns its error to the caller, and the next bonus change on that session still lands.
- [x] The harness's hold-a-call helper is reusable by later tickets and documented in the harness.
- [x] `bonus-changed.spec.ts` and the other existing specs pass unchanged.

## Comments

Implemented in the commit `feat(backend): bonus changes go through one session write` (see git history for the hash). The queue is `SessionWriteQueue` (`apps/backend/src/game/state/session-write-queue.ts`); `GameStateService.writeSession` runs a change, reads standings last (opt-out: `refreshStandings: false`) and stores. The harness helper is `holdNextCall` in `real-store-test-utils.ts`. New spec: `session-write.spec.ts`. `CONTEXT.md` gains a **Session write** entry.
