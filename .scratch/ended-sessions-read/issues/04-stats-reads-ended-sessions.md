# 04: Stats reads its sessions from the Ended-sessions read

**What to build:** The stats list, the stats session detail and the feedback trends get their sessions, names and max points from the Ended-sessions read. Users see no change: the stats list shows and sorts by the same names and max points, still paged in SQL. The detail opens only ended sessions, and the feedback trends cover the same nights.

The ended sessions query gains a **max points** column: the sum of the points of the questions in the session's quiz, 0 for a quiz with none. Each session plays its own copy of the quiz.

- The stats list builds on the ended sessions query, joins the Standings session totals as before, and sorts by its display name and max points columns. Its own max-points subquery and its name expression are deleted.
- The session detail gets its header from the one-ended-session read.
- The feedback trends narrow the ended sessions query by date range or league, and keep their feedback-setting filter.
- The stats display-name helper is deleted.

See the spec's "Max points" and "Readers → Stats".

**Blocked by:**

- 03 (Team history and league read their nights from the Ended-sessions read)
- `.scratch/session-result-module/issues/04-stats-reads-session-result.md`

Session result ticket 04 rewrites the stats session detail. This ticket goes after it so the two don't conflict.

**Status:** done

- [ ] The stats list shows the same rows, names and max points, and sorting by session name, max points, date, team count and winner gives the same order as before, still paged in SQL.
- [ ] The stats session detail is a 404 for an unknown session or one that hasn't ended, as today.
- [ ] Feedback trends include only ended sessions that collected feedback, in the range or league, as today.
- [ ] The stats service has no status filter, max-points subquery or display-name logic of its own.
- [ ] Adapter spec cases:
  - max points sums the session's quiz questions and is 0 for a quiz with no questions;
  - for the same session, the adapter's max points equals the Session result module's max points computed from that session's questions.
- [ ] Stats service spec cases that only exercised the ended filter move to the adapter spec. Its happy paths and HTTP-shape cases still pass.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass. `pnpm e2e` has been run once before the PR.
