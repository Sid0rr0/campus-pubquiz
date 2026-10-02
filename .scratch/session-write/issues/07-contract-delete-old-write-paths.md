# 07: Contract: standings only from the session write; delete the old write paths

**What to build:** The session write becomes the only place standings are read for a live session, and the only way to change one. The grading refresh no longer fetches standings and its result loses its leaderboard field. Inside Commit a move, the grading stages, the showdown resolve and turning the leaderboard on stop fetching standings, because the press's session write reads them last. The helper that writes one field directly is deleted, along with the comments that warned against a read-modify-write across an `await`.

Restore and session creation get their standings the same way: placing a session at its starting point ends with the standings read before the session is first stored. A session restored after a backend restart, in any status, therefore has its leaderboard in the first snapshot a reconnecting client receives.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 02, 03, 04, 05, 06

**Status:** done

- [x] Written first, failing against today's code: a session restored outside the break with scored answers has a non-empty leaderboard in its first snapshot.
- [x] A restored session in the break has its ungraded set and its leaderboard in its first snapshot.
- [x] Turning the leaderboard on shows every joined team, zero-point teams included. The showdown winner's bonus is on the leaderboard as soon as the final reveal step lands.
- [x] Nothing in the Live session module, the block grading module or Commit a move calls the Standings service except the session write's last step and placing a session at its starting point.
- [x] The session store is written only by the session write and by session creation and restore.
- [x] Every existing spec passes, apart from mechanical updates where a test reads the grading refresh result's leaderboard.
- [x] `CONTEXT.md` gains **Session write** (every change to a live session: one at a time per session, ending with fresh standings). **Grading refresh** drops "and fetches fresh standings". `DOCUMENTATION.md` says events for one session are applied one at a time.

## Comments

Implemented in the commit titled `feat(backend): standings come only from the session write` (hash is in git history).

- `gradingRefresh` no longer fetches standings and `GradingRefresh` lost its `leaderboard` field; `BlockGradingService` no longer takes the Standings service. `withGradingRefresh` only updates the ungraded set. No spec read the refresh result's leaderboard, so no mechanical spec updates were needed.
- Commit a move: the showdown resolve and the leaderboard-on refresh no longer fetch standings. `place` (creation and restore) now ends with the standings read before the session is first stored. The only Standings service callers left are `writeSession` and `place`.
- The single-field `update` helper and the read-modify-write comments were already gone after 06; the remaining stale wording (grading refresh docs, store comment) is cleaned up.
- Red first: a session restored in `question_open` with a scored answer had an empty leaderboard in its first snapshot. The break-restore case already passed (the break-entry refresh used to fetch standings) and stays as a regression test. The zero-point leaderboard-on and showdown-winner-bonus criteria are pinned by the existing `leaderboard` and `showdown-reveal` specs, which pass unchanged.
- Review note (not changed, it's the spec's design): the standings read is the last step of a write, after a press has saved its progress. If that read throws, the press fails and memory stays on the old status while the database is on the new one, until a restart or the next press. Previously only the leaderboard-on read ran inside a press, and it ran before the save.
