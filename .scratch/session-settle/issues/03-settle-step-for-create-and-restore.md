# 03: Creation and restore go through the settle step

**What to build:** Introduce the settle step inside the Live session module: a pure step that, given one named input (the session, the progress it is moving to, the causing action or none, the current time, and — for restore only — the saved phase timer to resume), returns the session with every progress-dependent field consistent with that progress: phase timer, auto-lock deadline, kahoot question deadline, break end time, leaderboard reveal count, closest_guess step. Its internal order is fixed (phase timer, then the deadlines that read it, then the rest). Creating a session and restoring sessions after a restart both go through it. Behaviour is unchanged.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** 02 (Restart and creation pin the derived session fields)

**Status:** done

- [x] The settle step takes one named input object — no positional argument lists — and derives every progress-dependent field
- [x] Creating a session settles from the lobby with no action; the fresh-session builder keeps only progress-independent defaults (teams, empty caches, display text scale)
- [x] Restoring after a restart settles the saved progress with the saved phase timer in one call; the hand-written kahoot deadline recompute on restore is deleted
- [x] Restore semantics are unchanged: the phase timer resumes exactly, the auto-lock deadline re-arms fresh, the kahoot deadline follows the resumed phase timer
- [x] The settle step has no tests of its own; ticket 02's cases and the existing restart, timer, persistence and session lifecycle specs pass unchanged

## Comments

Implemented in one commit (hash in git history). New `session-settle.util.ts` holds `settleSession` (one named input: session, progress, action or null, now, optional saved phase timer) and now owns the lock-deadline, kahoot-deadline and break-end rules. `freshSessionState` only sets progress-independent defaults; `createSession` and `onModuleInit` settle through it, and the hand-written kahoot recompute is gone. `now` was added as an optional trailing parameter on `computePhaseTimerFields`, and `action` widened to `GameAction | null` on the reveal-count and closest_guess step helpers. No new tests; all `src/game` specs pass unchanged. `computeQuestionLockAt` / `computeKahootQuestionEndsAt` stay exported only because `applyTransition` still assembles fields by hand until ticket 04.

Full run: shared-types and backend green, lint clean. 5 frontend failures in `app/play/__tests__/break-and-reveal.test.tsx` also fail on a clean main (untouched by this change).
