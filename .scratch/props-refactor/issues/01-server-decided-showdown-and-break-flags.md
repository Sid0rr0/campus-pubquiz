# 01: The admin view decides showdown eligibility and last-question-before-break

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** Whether the quiz master may set up the showdown tiebreaker, and whether the current question is the last one before a break, are decided by the server and arrive in the admin view, like Advance/Previous availability already do. Today /control works both out in the browser from a separately fetched quiz list, and the showdown check hand-copies the backend's graded-status list.

The admin view gains two admin-only booleans, "showdown eligible" and "last question before break", computed in the Screen projection's admin branch from the live session:

- **Showdown eligible:** on the final round, no questions left ungraded, and the status is one of the graded statuses the block-grading service owns.
- **Last question before break:** a question is open or locking, and the current question is a break point in the session's own round structure.

/control reads both from the admin view (on every broadcast and on reconnect) and stops deriving them. The quiz master sees no change, except that these controls are right straight after a reconnect and no longer depend on the quiz list request succeeding.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The admin view type carries both flags; the display and players views do not
- [ ] Backend Screen projection specs cover showdown eligible across the graded statuses, off the final round, and with questions still ungraded
- [ ] Backend Screen projection specs cover last question before break at a block's last question versus mid-block, in question open, locking and a non-question status
- [ ] /control reads both flags from the admin view; its hand-copied graded-status list and the client derivations of both flags are deleted
- [ ] The /control test fixture builder defaults both flags to false; the showdown panel and break-end-time tests set them on the fixture instead of relying on the mocked quiz list
- [ ] Existing /control page tests pass unchanged in behaviour
