# Spec: Every change to a live session is one session write, ending with fresh standings

Status: ready-for-agent

Blocked by: — (follows standings-module, grading-refresh, live-session-module and commit-a-move, all done)

## Problem Statement

During a quiz night several things change a live session at once. Teams submit answers from their phones, the quiz master grades and awards bonuses on `/control`, a phase timer expires, a team joins or gets kicked, and the quiz master fixes an answer key mid-break. Each of these is handled by the Live session module. Each one reads the session, waits on the database (saving answers, grading, loading standings, saving progress), then writes its result back.

Nothing orders those writes for one session, so two events that overlap can undo each other:

- **A press can wipe out a change that happened while it ran.** An admin press (Advance, a timer expiry, Toggle leaderboard) takes the session as it stood when the press began, grades, settles and saves progress, then stores its own copy. An answer submitted, a team joining or a bonus awarded during those milliseconds is overwritten. The phone shows the answer as sent, but `/control`'s answered markers lose that team. A team that just joined can show as disconnected. The leaderboard can lose a bonus until the next score change happens to refresh it.
- **Restoring a session or reloading a quiz can do the same.** A quiz reload (a live edit or a re-import) and a settings change also read the session, await the database and store the old copy plus their change.
- **The leaderboard can go backwards.** Seven events each fetch standings and then apply them: team joined, team removed, bonus changed, answer recorded or graded (through the grading refresh), key fix, and the grading stages, showdown resolve and leaderboard turned on inside a press. Two fetches can finish in the opposite order to the one they started in. The older standings then land last and the big screen shows a score that has already moved on, until some later event happens to refresh it. A comment on the grading refresh already warns about this ("must not become a read-modify-write of the session across an await"). Every writer works around it separately rather than having it removed.
- **Each new score path has to remember to refresh standings.** Whether the leaderboard is current depends on every event author remembering to call the Standings service at the right point.

At pub-quiz scale these windows are short, but they're busiest exactly when it matters: the last seconds of a question, when every team submits and the timer locks.

## Solution

Every change to a live session runs as one **session write**:

- **Writes to one session never overlap.** Each session has its own queue, and a write starts only once the previous one for that session has finished (stored, refused or failed). Writes to different sessions still run in parallel.
- **A write sees the session as the previous write left it**, does its database work, and stores its result. Nothing can store a session it read before another write finished.
- **Every write ends with fresh standings.** As the last step before storing, the write reads the session's standings once and puts them on the session. Only writes that are explicitly declared as not touching scores skip this (connection drops, break end time, display text size, showdown guesses, a new showdown round, lobby settings). Grading, presses, bonuses and roster changes no longer fetch standings themselves.
- **A failed or refused write changes nothing and doesn't block the queue.** The caller still gets the error (a refused press still returns its reason). The next queued write runs against the unchanged session.

For the people in the room nothing looks different, except that the leaderboard, answered markers and connection dots are always right after a busy moment.

## User Stories

1. As a team, I want my answer submitted in the last second before the timer locks to show as answered on `/control`, so that the quiz master doesn't think we missed the question.
2. As a quiz master, I want an answer that arrives while I press Advance to still be counted and marked, so that pressing at a busy moment never loses a team's answer from my view.
3. As a quiz master, I want a team that joins while I'm advancing the quiz to show as connected, so that I don't chase a team that is actually online.
4. As a quiz master, I want a bonus I award while a timer expires to stay on the leaderboard, so that I don't have to award it again or wait for another score change.
5. As a team, I want the big screen's leaderboard never to go back to an older score, so that we never see our points drop and come back.
6. As a quiz master, I want two quick grades in a row to leave the leaderboard showing both, so that the standings I read out are right.
7. As a quiz master, I want kicking a team during a press to remove it from the roster and the leaderboard together, so that a removed team never comes back on the big screen.
8. As a quiz master fixing an answer key mid-break, I want answers graded at the same moment to keep their grades and the ungraded markers to stay right, so that I can trust the markers before I advance.
9. As a quiz master, I want a quiz re-import during a live session not to undo a change that landed while it was reloading, so that the session stays consistent.
10. As a quiz master, I want a refused press (Advance while answers are ungraded) to leave the session exactly as it was and not hold up teams' answers, so that a refusal never freezes the game.
11. As a quiz master, I want a failed database save on one event not to block later events, so that one hiccup doesn't stall the whole quiz.
12. As a quiz master running two sessions at once, I want one session's busy moment not to slow the other down, so that parallel games stay independent.
13. As a team reconnecting after my phone slept, I want the state I'm sent to include every write that finished before I reconnected, so that my screen is right straight away.
14. As a quiz master, I want the leaderboard to include a team from the moment it joins, at zero, through the same final standings step, so that every joined team appears whichever event happened last.
15. As a quiz master, I want the showdown winner's bonus on the leaderboard as soon as the final reveal step lands, so that the big screen shows the decided winner.
16. As a quiz master, I want turning the leaderboard on to show every currently joined team, so that no team is missing at zero points.
17. As a quiz master restarting the backend mid-quiz, I want the restored session to come back with fresh standings and its ungraded set, so that reconnecting clients see correct scores.
18. As a developer adding a new score-changing event, I want fresh standings to come with every session write by default, so that I can't forget to refresh the leaderboard.
19. As a developer adding a new event, I want one way to change a live session, so that I don't have to reason about which awaits might interleave with other events.
20. As a developer, I want the "can't be a read-modify-write across an await" comments to disappear because the problem is gone, so that the code says what it does rather than how it avoids a race.
21. As a developer, I want the overlap behaviour pinned by gateway-level tests that force two events to interleave, so that a regression shows up in CI rather than on stage.

## Implementation Decisions

- **The session write lives in the Live session module.** It has one internal operation shaped like _run this change against the current session, then store it_. The change is async and receives the session as the previous write left it. It returns the next session and the event's outcome, or throws. Every public event method of the Live session module goes through it: team connected, team disconnected, team removed, answer recorded, answer graded, bonus changed, quiz edited, quiz reloaded, admin press (the admin's and both timers'), showdown round created, showdown guess submitted, break end time set, display text scale set, session settings updated and session closed. The synchronous helper that writes one field directly is removed. The session store is written only by the session write and by session creation and restore, which happen before any event can reach the session.
- **The queue is per join code and lives in memory.** It's a chain of promises keyed by join code, held next to the session store. That matches the single-backend-instance constraint in CLAUDE.md: no Redis, no database locks, no advisory locks. Writes to different join codes don't wait for each other. A failure in one write is caught for the purpose of chaining, so the next write still runs, and is still passed on to that write's caller.
- **Not re-entrant, on purpose.** A queued change must not call another public event method of the Live session module, or it would wait on itself. Steps that are both public today and used inside other events (quiz reload and regrade inside quiz edited) are split: the inner step takes a session value and returns a session value, and only the event method queues. The quiz re-import path calls the queued quiz-reloaded event.
- **Standings are the last step of every write.** After the change returns its session, the session write reads standings once and sets the leaderboard before storing. A write declared as not changing scores skips the read. The declaration is an option on the write that defaults to refreshing, so forgetting it costs one extra query, not a stale leaderboard. The read happens inside the write, so it can't be overtaken by a later write's read.
- **Standings come out of the grading refresh and the press.** The grading refresh keeps working out which refreshed questions are ungraded. It no longer fetches standings, and the grading refresh result loses its leaderboard field. Inside Commit a move, the showdown resolve stops fetching standings, and so does the refresh when the leaderboard is turned on. The kahoot speed scoring, block grading and break-entry refresh keep their grading writes but leave standings to the session write. Commit a move's own interface stays the same. It still returns the next session and outcome or refuses, and the press event runs it inside a session write.
- **Restore and creation get standings the same way.** Placing a session at its starting point (new session, restart restore) ends with the same standings read before the session is first stored, so the restored leaderboard isn't empty until the first event.
- **Outcome delivery stays outside the queue.** The write stores the session and returns the outcome. Delivering it (broadcasting each room's view, the admin answer lists, team syncs, notices) happens after the write has left the queue, so a slow socket emit never holds up the next write. A broadcast may already include a later write's changes. That's acceptable, because every room view is rebuilt from the latest stored session.
- **Reads aren't queued.** Snapshots, room views, the presenter context and the getters the gateway still uses read the latest stored session. While a write is in progress they see the session as it was before that write, which is consistent.
- **Closing a session goes through the queue**, so a write still in progress can't put a closed session back. A write queued behind the close fails with the existing "unknown session" error.
- **No schema, protocol or payload changes.** The snapshot, room views and socket events are unchanged.
- **Docs.** `CONTEXT.md` gets a **Session write** entry ("every change to a live session: one at a time per session, ending with fresh standings"). The **Grading refresh** entry loses "and fetches fresh standings". `DOCUMENTATION.md`'s description of how state changes are applied gets a sentence saying events for one session are applied one at a time.

## Testing Decisions

- **A good test asserts only what clients receive.** Drive the gateway with real Postgres, make two events overlap, and assert the last state snapshot and answer lists that the admin, display and players rooms receive. Don't assert queue internals, the order of calls or how many standings reads ran.
- **One seam: the real-store gateway harness** (the testcontainers harness that the bonus-changed, team-removed, answer-recorded-and-graded and commit-a-move specs use). To force an overlap, the test holds one database-facing call open with a deferred promise, sends the second event, then releases the first. Good places to hold are the progress save, the standings read and the answer save. They're the harness's own collaborators, so the test controls timing without mocking the Live session module.
- **Cases:**
  - An answer submitted while a press waits on its progress save is still in the admin snapshot's answered markers and answer list once both finish.
  - A team joining while a press is in progress is still shown as connected and on the leaderboard afterwards.
  - Two bonus awards (or a grade then a bonus) where the first one's standings read is held: the final leaderboard reflects both, and no snapshot after the second one shows the first one's older totals.
  - A kick during a press: the roster and leaderboard both lose the team, and it doesn't come back.
  - A refused press (Advance out of the break with an ungraded answer), followed by a grade: the press reports its refusal, the grade lands, and the session hasn't moved.
  - A failed save (the progress save rejects once) followed by an answer: the answer still lands.
  - Writes to two sessions: holding one session's save doesn't hold up the other session's answer.
  - A restored session in the break has a non-empty leaderboard in its first snapshot.
- **Existing specs stay green unchanged** apart from mechanical updates where a test reads the grading refresh result's leaderboard field, which is removed. The leaderboard, bonus-changed, team-removed, answer-recorded-and-graded, live-edit-regrade, showdown-reveal and commit-a-move specs already pin "this event ends with fresh standings". With standings centralised they now pin it through the session write.
- **Prior art:** `bonus-changed.spec.ts` and `team-removed.spec.ts` for reading the last admin snapshot's leaderboard; `commit-a-move.spec.ts` for refused presses and saves that fail; `ungraded-restore.spec.ts` for restore.

## Out of Scope

- Narrowing the Live session module's remaining getters, or moving the owner-socket and showdown-timing rules out of the handlers (review candidate #4).
- Folding the shallow state helpers, or making the quiz re-import notify clients the way a live edit does (review candidate #6). This spec only routes the re-import's reload through the queue. Whether it then broadcasts is unchanged.
- Serialising across backend instances. One instance is a stated constraint.
- Rate-limiting or merging bursts of answers into fewer standings reads. One read per write is fine at pub-quiz scale. Revisit only if profiling says otherwise.
- Ordering of outcome delivery between writes. Delivery reads the latest session, so a later broadcast always wins.
- Who-graded-what attribution (a separate accepted tradeoff).

## Further Notes

- Source: candidate 5 ("Standings refresh after any score change, in one place") of the architecture review dated 2026-10-02. Since that review, standings-module made one Standings service that every refresh calls. What's left of that candidate is ordering, so this spec is mainly about the per-session write. The single standings step comes with it.
- The review's interface sketch was "mutateSession(joinCode, fn), serialised per session". This spec keeps that shape, adds the opt-out for writes that don't touch scores, and makes the re-entrancy rule explicit.
- No ADR covers this area. If the queue ever needs to survive across instances, that would be an ADR-worthy change to the single-instance constraint, not an extension of this one.
- Suggested order: introduce the session write with standings at its end and route the in-memory-only events through it. Then move answer, grade, bonus and roster events, removing their standings reads. Then the press and both timers, removing the press's own standings reads. Then quiz edited and reload, splitting the inner steps. Then restore, creation and close. Each step leaves the suite green.
