# 03: Creation and restore go through the settle step

**What to build:** Introduce the settle step inside the Live session module: a pure step that, given one named input (the session, the progress it is moving to, the causing action or none, the current time, and — for restore only — the saved phase timer to resume), returns the session with every progress-dependent field consistent with that progress: phase timer, auto-lock deadline, kahoot question deadline, break end time, leaderboard reveal count, closest_guess step. Its internal order is fixed (phase timer, then the deadlines that read it, then the rest). Creating a session and restoring sessions after a restart both go through it. Behaviour is unchanged.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** 02 (Restart and creation pin the derived session fields)

**Status:** ready-for-agent

- [ ] The settle step takes one named input object — no positional argument lists — and derives every progress-dependent field
- [ ] Creating a session settles from the lobby with no action; the fresh-session builder keeps only progress-independent defaults (teams, empty caches, display text scale)
- [ ] Restoring after a restart settles the saved progress with the saved phase timer in one call; the hand-written kahoot deadline recompute on restore is deleted
- [ ] Restore semantics are unchanged: the phase timer resumes exactly, the auto-lock deadline re-arms fresh, the kahoot deadline follows the resumed phase timer
- [ ] The settle step has no tests of its own; ticket 02's cases and the existing restart, timer, persistence and session lifecycle specs pass unchanged
