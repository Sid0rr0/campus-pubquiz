# Spec: Deepen the Live session module

Status: ready-for-agent

## Problem Statement

During a live quiz, the admin, the big screen and the teams' phones sometimes show state that is out of date or wrong. A page reload, or the next unrelated action, is usually what fixes it:

- **Leaderboard after an auto-graded submit.** When a team submits an answer that grades itself (multiple choice, sort, match, free text), the points go into the database, but the leaderboard the admin, display and phones see keeps the old totals. It only catches up when some later action happens to refresh it (a manual grade, a bonus, toggling the leaderboard).
- **Kicked or departed teams.** A team that is kicked, or leaves the session itself, stays on the cached leaderboard with its points until something else triggers a refresh. /control works around this by merging the roster and leaderboard on the client and zero-filling missing teams.
- **Closest-guess questions show as "not yet graded".** Every closest_guess answer submitted while the question is open flags the question as having ungraded answers. The admin's question browser then shows a "not yet graded" dot, and showdown eligibility is computed from the same wrong data. It only corrects itself once the game reaches a grading status. Closest_guess answers are graded in one batch after the question locks and can never be graded by hand, so the flag is simply wrong.
- **Correcting the answer key mid-game.** When the admin fixes the answer key or points of an already-shown question, answers are re-scored, but the grading panel keeps showing the pre-regrade points. Teams' phones keep their cached grades until the next reveal.
- **Timer paths drift from the admin path.** When a question auto-locks on a timer, the steps that follow a manual Advance are copied by hand, and some are not copied at all. The copies have already diverged.

The root cause is structural. The in-memory session record holds several derived caches: the leaderboard, the ungraded-question ids, and which teams have answered. It also relies on follow-up pushes to rooms (state snapshot, admin answer list, per-team answer sync). Every socket handler and REST notification decides for itself which caches to refresh and which rooms to push to. The session-state module exposes its record field by field, through a pass-through layer of about fifteen one-line setters. Consistency is therefore the job of eleven-plus callers, and several of them forget a step.

The existing gateway tests don't catch any of this. They back the game with an answer store that returns the same fixed data on every call, so a missing refresh is indistinguishable from a correct one.

## Solution

The Live session module owns the session record and everything derived from it:

- **Callers report what happened.** A team recorded an answer, an admin graded one, a team was removed, a bonus changed, the quiz was edited, an admin action or timer advanced the game.
- **The module keeps itself consistent.** It refreshes every derived cache that event affects, using one rule per cache: closest_guess never counts as ungraded, removed teams leave the leaderboard, any points change refreshes totals.
- **It returns an outcome** stating which rooms must hear about it. The socket layer delivers that outcome the same way for every event, so no path can forget a push.

The admin, display and teams see correct totals, correct "ungraded" indicators and corrected grades immediately after every action, whether it came from a person, a timer or a live quiz edit.

## User Stories

1. As a quiz master, I want the leaderboard totals to update the moment an auto-graded answer is submitted, so that toggling the leaderboard mid-round never shows stale scores.
2. As a quiz master, I want a kicked team to disappear from the leaderboard immediately, so that the standings I show on the big screen only include teams still in the game.
3. As a quiz master, I want a team that leaves the session to disappear from the leaderboard immediately, so that renamed teams don't appear twice.
4. As a quiz master, I want closest_guess questions never to show a "not yet graded" dot, so that I'm not misled into thinking I have manual grading to do.
5. As a quiz master, I want showdown eligibility to reflect only questions that genuinely need my grading, so that closest_guess questions never block or unblock a showdown incorrectly.
6. As a quiz master, I want the grading panel to show re-scored points right after I correct a shown question's answer key, so that I can see the correction worked.
7. As a quiz master, I want the leaderboard to reflect re-scored points right after a live answer-key correction, so that the big screen never shows totals from the wrong key.
8. As a team, I want my phone to show my re-scored grade right after the quiz master corrects the answer key, so that I'm not confused by a grade that contradicts the reveal.
9. As a quiz master, I want an auto-lock by the question timer to behave exactly like pressing Advance myself, so that every team and screen gets the same updates whichever way the question locked.
10. As a quiz master, I want a kahoot question's timer auto-lock to behave exactly like pressing Advance myself, so that kahoot rounds aren't a special case with their own gaps.
11. As a quiz master, I want the leaderboard to be fresh whenever I toggle it on, whatever action last changed points, so that I never have to toggle it twice.
12. As a quiz master, I want bonus awards (from the socket or edited via REST) to update totals the same way grading does, so that bonus points are never missing from the board.
13. As a quiz master, I want the "which teams have answered" indicators to update whenever any team submits, so that I can see who's still thinking.
14. As a quiz master, I want the ungraded-question indicators to update the moment I grade the last ungraded answer to a question, so that I know when a question is done.
15. As a quiz master, I want the ungraded-question indicators to update the moment a team changes an already-graded answer, so that I notice answers that need re-grading.
16. As a team, I want my submission acknowledged with my own answer and any auto-graded points exactly as today, so that the deepening changes nothing I rely on.
17. As a team, I want to be rejected when answering a locked or hidden question exactly as today, so that answer locking keeps its current guarantees.
18. As a team, I want to be rejected when answering on behalf of another team exactly as today, so that team identity stays protected.
19. As a big-screen display, I want to receive exactly one fresh state snapshot after each change, so that transitions don't flicker from redundant or out-of-order updates.
20. As the admin room, I want presenter context to keep arriving before the state snapshot after each change, so that /remote's preview never lags the screen.
21. As the admin room, I want the answer list for a question to be pushed whenever any answer to it changes (submit, grade, regrade), so that the grading panel is always current without a REST refetch.
22. As a connected team, I want my full graded-answer list pushed when my block enters reveal (including kahoot's collapsed lock-to-reveal) exactly as today, so that the reveal screen shows my true points.
23. As a quiz master, I want admin-action errors (illegal transitions, ungraded answers blocking Advance) to reach me with the same messages as today, so that the control panel's toasts keep working.
24. As a developer, I want a single place that decides which derived caches an event invalidates, so that adding a new event can't silently skip a refresh.
25. As a developer, I want a single place that decides which rooms hear about an event, so that adding a new event can't silently skip a push.
26. As a developer, I want the pass-through setters removed from the Live session module's interface, so that callers can't put the session record in an inconsistent state.
27. As a developer, I want gateway tests to run against a real answer, team and bonus store, so that a missing refresh fails a test instead of reaching a live event.
28. As a developer, I want tests to assert on what each room received, not on which internal methods were called with which positional arguments, so that refactors inside the module don't break tests.
29. As a developer, I want the timer-driven Advance and the admin Advance to share one code path, so that fixes to one automatically apply to the other.
30. As a developer, I want the kicked/left-team roster refresh and the leaderboard refresh to happen together, so that roster and standings can never disagree in one snapshot.
31. As a developer, I want the closest_guess exclusion from "ungraded" defined once, so that the incremental and bulk refreshes can't diverge again.
32. As a developer, I want restart recovery (restoring progress and timers from persistence) to behave exactly as today, so that the deepening doesn't weaken reconnection, which is a core feature.
33. As a developer, I want concurrent sessions to stay isolated through the new interface, so that one session's events never refresh or push to another session's rooms.

## Implementation Decisions

- **Live session module.** The existing game-state module becomes the Live session module: the single owner of each session's in-memory record and of all derived caches (leaderboard, ungraded-question ids, answered-team ids, roster). The term "Live session" should be added to the domain glossary when one is created.
- **Event-shaped interface.** The module's public interface is a small set of operations, one per domain event:
  - record a team's answer
  - grade an answer
  - remove a team (kicked or left)
  - team connected / disconnected
  - bonus awards changed
  - quiz edited (with the ids of questions to regrade)
  - apply an admin action (also used by timer expiry)
  - admin-only setters for display settings (break end time, text scale, showdown setup)

  Each mutating operation returns an **outcome** describing what must be pushed:
  - whether a state broadcast is needed
  - which question ids need a fresh admin answer list
  - which teams need a per-team answer sync
  - any direct per-socket notices (e.g. kicked, bonus awarded)

  Read-only queries the socket layer needs remain available: the snapshot, presenter context, admin question context, answerability, the connected socket for a team, the session id, and timer deadlines.
- **Pass-through layer removed.** The separate mutations layer of read-spread-write setters is deleted. Its logic moves inside the module's implementation. The field-level setters for leaderboard, teams, answered-team ids and graded status are no longer on the interface.
- **One refresh rule per cache, applied inside the module:**
  - **Leaderboard:** recomputed after any event that can change points or the roster (answer recorded, answer graded, team removed, bonus changed, regrade, batch/kahoot grading, leaderboard toggled on).
  - **Ungraded-question ids:** derived by one rule that always excludes closest_guess, used by both the per-question incremental update and the bulk refresh on entering grading statuses.
  - **Roster and leaderboard** are refreshed together on team removal.
- **Outcome delivery in the socket layer.** A single delivery step in the socket layer turns an outcome into emits. The ordering is unchanged:
  1. presenter context to admin
  2. the state snapshot to all three rooms
  3. the admin answer lists and per-team answer syncs the outcome names
  4. per-socket notices

  Every socket handler, timer callback and REST-triggered notification (quiz edited, bonus awards changed, settings updated) calls the module, then this delivery step. Nothing else emits game-state events.
- **Timers.** Question-lock and kahoot timer expiry use the same "apply admin action" operation and outcome delivery as a manual Advance. The special-casing that skips the reveal-entry team sync on the kahoot path goes away, because the outcome decides it from the actual transition. Timer re-arming still follows every applied action.
- **Live answer-key edits.** The quiz-edited operation returns an outcome that names every regraded question (fresh admin answer lists) and every connected team with an answer to a regraded question (per-team sync), and that requests a state broadcast with a fresh leaderboard.
- **Unchanged contracts:**
  - socket event names and payload shapes
  - the order of emits within one change
  - error messages surfaced to clients
  - persistence of progress
  - the auto-grading rules themselves (scoring per question type is a separate candidate)
  - the in-memory-only kahoot speed multipliers tradeoff
- **Snapshot contents are unchanged in this spec.** The leaderboard is still part of the tri-room snapshot. Per-room redaction is a separate candidate.

## Testing Decisions

- **One test seam: the gateway.** Tests drive socket events (connections, admin actions, submits, grades, kicks, leaves, bonus awards) and the REST-triggered notifications on the gateway, then assert on what each room and socket received. Tests do not call the Live session module directly and do not assert on internal method calls or their arguments.
- **Real stores behind the seam.** The gateway test harness is backed by the real answer, team, bonus and showdown modules on a Postgres testcontainer, with migrations applied, instead of the fake answer store that returns fixed data. The seed/game-progress fixtures remain as today where they don't affect derived state. Persistence-dependent tests (restart recovery) keep using the real game-progress repository.
- **What makes a good test here.** It exercises a sequence a quiz master or team could actually produce, then asserts on a room-visible outcome. Examples:
  - "after a team submits a correct multiple-choice answer, the next state snapshot's leaderboard shows their points"
  - "after the admin kicks a team, the next snapshot's leaderboard no longer contains it"
  - "after a closest_guess submit, the snapshot's ungraded ids do not include that question"
  - "after correcting a shown question's answer key, the admin room receives that question's answer list with re-scored points and the team receives a synced answer list"
  - "a timer-driven lock produces the same emits as a manual Advance"
- **Regression tests first.** Each bug in the Problem Statement gets a failing test through the gateway before the module is restructured. Existing gateway specs are migrated to the real-store harness. Specs that asserted exact positional arguments on the fake answer store are rewritten to assert room-visible results.
- **Prior art:**
  - the Postgres-testcontainer setups used by the answer, team, showdown, stats and game-progress repository specs (container per suite, migrations up, truncate between tests)
  - the existing gateway harness and its mock server/socket helpers for driving events and capturing emits
  - the existing session-snapshot leak and concurrent-sessions specs, which should continue to pass unchanged in intent
- **Speed.** One container per test file, reused across its tests with truncation between tests, keeps the suite practical. The spec accepts the slower harness in exchange for catching cross-module bugs.

## Out of Scope

- Changing how each question type is scored, how kahoot speed multipliers are computed, or where response time comes from (candidate "Scoring module").
- Per-room redaction of the snapshot, including keeping a kahoot question hidden behind the leaderboard off the phones and hiding leaderboard totals from phones before reveal (candidate "Screen projection").
- Unifying participation, ranking and tie rules between the live leaderboard and stats (candidate "Standings module").
- Frontend changes, including removing /control's client-side roster/leaderboard merge. It becomes unnecessary but can be simplified separately.
- Collapsing the gateway's repeated parse/authorize/log boilerplate into a declarative guard (candidate "gateway handler template"). This spec only changes what the handler bodies call.
- Attributing grading to a user (`gradedBy`).

## Further Notes

- This is the top recommendation from the 2026-09-30 architecture review. The other candidates listed under Out of Scope build on this one: once every change flows through one module and one delivery step, redaction and scoring changes each have a single place to go.
- The kicked-team leaderboard fix also changes what /control's teams table receives. Its zero-fill merge stays harmless but should be revisited.
- Reconnection is a core feature. Snapshot-on-reconnect must keep returning the same full state, and it now comes out consistent by construction.
