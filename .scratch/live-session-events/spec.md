# Spec: Team events go into the Live session module; the getters go

Status: ready-for-agent

Blocked by: — (follows live-session-module, grading-refresh and commit-a-move, all done)

Source: architecture review of 2 Oct 2026, candidate 4 ("Worth exploring").

## Problem Statement

The domain rules of a live quiz are meant to live in the Live session module. In practice, the socket handlers apply several of them on their own. They read the session through narrow getters, decide for themselves whether an event is allowed, and only then call back into the module:

- **Who owns a team's seat.** "Only the socket connected for a team may act for it" is written out in three handlers: submit answer, submit showdown guess and leave session. Kick and join also read the team's connected socket, to close it or to decide whether a new device may take the seat over. A new team event can easily miss the check, and nothing in the module would notice.
- **When a showdown accepts guesses.** The handler decides on its own that guesses are accepted only while the round is active, unresolved, the one named, and the showdown reveal is still at step 0. The phone screen in shared types makes the same step-0 decision separately when it picks showdown_guessing over showdown_reveal. If either side changes, a phone can show the guess form while the server refuses guesses, or the other way round.
- **Kahoot response time.** The submit handler reads when the phase started and works out the team's response time itself. Kahoot speed scoring in the Commit-a-move module uses the same start time as its anchor, so the two must agree, yet the math sits outside the module.
- **Whether a question is open for answering, and the bonus rules** (enabled categories, maximum awards per category) are fetched by the handlers through getters and passed on to other services.
- **Roster fetches.** Leave, kick and join each remove or add the team, list the roster themselves, then hand the roster back to the module.

As a result, the module's interface is about as wide as its implementation, at roughly 35 public methods including some fifteen one-line getters. Some methods exist only for tests or for one other caller: `applyAction` is used only by a test, `regradeQuestions` only internally, and `reloadActiveQuiz` by the import path, which reloads the quiz but never broadcasts it, unlike a quiz edit. Delivering an outcome still asks the module for a team's socket so it can sync that team's answers. A kick also has to remember the team's socket before the team is removed so it can close it afterwards.

None of this shows on stage today, but every new team-facing event repeats the same guard-then-call pattern by hand, and a rule that is wrong in one handler cannot be tested without a socket.

## Solution

The Live session module takes **team events in and gives outcomes back**. Each event method takes the session's join code, the event's payload and the id of the socket that sent it. Inside, the module:

1. checks whether the event is allowed: seat ownership, question open, showdown accepting guesses, bonus category rules
2. computes anything time-based, such as kahoot response time
3. calls the service that persists the event: answers, teams, showdown, bonus
4. fetches the roster where needed
5. refreshes its derived state
6. returns a Session outcome, or refuses with a domain refusal

The outcome now also carries what used to need a socket lookup afterwards: the direct reply to the sender, the resolved socket of each team to sync, and the sockets to close.

The socket handlers become thin adapters: they parse the payload, call one event method and hand the result to outcome delivery. Outcome delivery stops asking the module for sockets. The field-level getters leave the module's public interface. `applyAction` is deleted, and `regradeQuestions` and `reloadActiveQuiz` become private. Import reports a quiz change through the same `quizEdited` entry that a live edit uses, so an import into a live session is broadcast too.

Teams, the admin and the big screen see the same behaviour as today. Refusals have the same messages, emits come in the same order, and the replies are the same. The one deliberate change is that an import into the active quiz now pushes a fresh view.

## User Stories

1. As a team on a phone, I want my answer accepted only while its question is open, so that a late tap after the lock can't change my score.
2. As a team, I want only my own phone to be able to submit answers for my team, so that another team can't answer in our name.
3. As a team, I want a clear message when my answer is refused, such as "Answers are locked for this question" or "You may only submit answers for your own team", so that I know why it didn't count.
4. As a team, I want the "answer received" confirmation, with my graded points for auto-graded types, to reach my phone before the room-wide update, as it does today, so that my phone shows the answer as saved straight away.
5. As a team in a kahoot round, I want my response time measured from the same moment the speed scoring uses, so that faster teams really do get more points.
6. As a team in a showdown, I want my guess accepted only while the showdown is still taking guesses, so that nobody can change a guess after the reveal has started.
7. As a team in a showdown, I want the guess form on my phone to show exactly while the server accepts guesses, so that I never type a guess the server will refuse.
8. As a team not in the showdown, I want a clear refusal if I try to guess, so that only the tied teams take part.
9. As a team, I want only my own phone to be able to submit a showdown guess for my team, so that the tiebreaker can't be hijacked.
10. As a team, I want "leave session" to work only from my own phone, so that nobody can log my team out remotely.
11. As a team that leaves, I want to disappear from the roster and leaderboard at once, so that a stale copy of my team doesn't stay on the big screen.
12. As a quiz master, I want kicking a team to remove it from the roster and leaderboard, send it the kicked notice and then close its socket, in that order, so that the phone knows why it was disconnected.
13. As a quiz master, I want kicking a team that is currently disconnected to still remove it, so that a dead entry doesn't stay on /control.
14. As a team whose phone reconnected on a fresh socket, I want to take my seat back from my own earlier socket, so that a network switch or a phone waking up doesn't lock me out.
15. As a team, I want a second device that tries to join as my team to be refused while my phone is still connected, so that nobody can take over my seat.
16. As a team that rejoins, I want my saved answers and bonus awards in the join reply, so that my phone shows where we stand at once.
17. As a quiz master, I want grading an answer by hand to refresh the leaderboard and the ungraded markers, so that /control and the big screen are right straight away.
18. As a quiz master, I want an invalid grade to be refused with a clear message, so that I can correct it.
19. As a quiz master awarding a bonus from /control, I want the session's enabled categories and per-category limit enforced, so that awards follow the rules I set in the lobby.
20. As a team receiving a bonus, I want the bonus notice on my phone, so that we see why our score changed.
21. As a quiz master, I want a socket that sends any team event without owning the team to be refused the same way for every event, so that no event is the weak spot.
22. As a quiz master importing a sheet into the active quiz while the session is in the lobby, I want /display, /play and /control to show the reloaded quiz at once, so that I don't need to reload any screen.
23. As a quiz master fixing the answer key on a live quiz, I want the same reload, re-grade and broadcast as today, so that nothing about live edits changes.
24. As a phone that reconnects after a sleep, I want the full current view for my role, unchanged by this work, so that resync still works.
25. As a team whose answers were re-graded, I want my phone's graded-answer list synced without the delivery step having to look up my socket, so that the sync reaches me whenever I'm connected.
26. As a developer, I want each team event to be one call to the Live session module, so that a new event can't skip seat ownership or the derived-state refresh.
27. As a developer, I want a domain refusal from the module turned into a socket error in one place, so that handlers don't each catch and rewrap errors.
28. As a developer, I want the module's public interface to have no one-line field getters for game rules, so that rules can't drift back into handlers.
29. As a developer, I want a single named rule for "the showdown is accepting guesses" that both the server guard and the phone screen kind follow, so that they can't disagree.
30. As a developer, I want `applyAction`, `regradeQuestions` and `reloadActiveQuiz` gone from the public interface, so that there is one way in for each kind of change.
31. As a developer, I want import to report a quiz change through `quizEdited`, so that there is exactly one "quiz changed under a session" entry.
32. As a developer, I want every rule in this spec tested through the real-store gateway harness, so that tests check behaviour on the wire and not internal calls.

## Implementation Decisions

**Event methods on the Live session module.** Each team-facing socket event gets one method that takes the join code, the event's payload fields and the sender's socket id. The method checks the event is allowed, persists it, refreshes derived state and returns a Session outcome:

- `submitAnswer(joinCode, { teamId, questionId, value }, socketId)` checks that the question is open and that the socket owns the seat, computes the kahoot response time from the phase start, submits through the answer service, then runs the existing answer-change refresh.
- `submitShowdownGuess(joinCode, { showdownRoundId, teamId, value }, socketId)` checks that the showdown accepts guesses, then seat ownership, then that the team takes part in the showdown, then stores the guess and records it on the session.
- `teamLeft(joinCode, teamId, socketId)` checks seat ownership, removes the team from the roster, lists the roster and runs the existing team-removed refresh.
- `kickTeam(joinCode, teamId)` is admin-only, so it has no ownership check. It removes the team, lists the roster, and the outcome carries the kicked notice plus the team's socket to close.
- `teamJoined(joinCode, joinRequest, socketId, isSocketLive)` joins through the team service. It then applies the seat takeover rule: a live socket that already holds the seat refuses the join, unless the request names that socket as its previous one, in which case the old socket is closed. Then it lists the roster, records the connection, and builds the join reply with saved answers and bonus awards. Only the socket layer knows whether a socket is live, so it passes in an `isSocketLive(socketId)` predicate; the rule itself stays in the module.
- `gradeAnswer(joinCode, answerId, pointsAwarded)` grades through the answer service, then runs the answer-change refresh for that answer's question.
- `awardBonus(joinCode, award)` reads the session's own bonus settings, awards through the bonus service, then runs the existing bonus-changed refresh with the team's notice.
- Showdown round creation moves in the same way: the "tied for first" check and the creation of the round happen inside the module.

**New dependencies.** The module takes the team service and the bonus service as constructor dependencies, alongside the answer, standings and showdown services it already has. Neither service depends on game state, so this adds no cycle.

**Domain refusals.** The module refuses with one refusal error type carrying the message teams see today. Errors already raised by other services (invalid showdown, invalid bonus award, join and grade failures) become that refusal inside the module. The guarded event dispatcher turns a refusal into a socket error in one place, so handlers no longer catch errors themselves. Existing messages stay word for word.

**Session outcome grows three fields.** These replace every socket lookup that happens after the event:

- **Replies**: emits to the sending socket, delivered before any room push. This keeps today's order for "answer received" and "join accepted".
- **Team syncs**: each carries the team's resolved socket id, resolved inside the module. Outcome delivery no longer asks for a team's socket.
- **Sockets to close**: delivered last, after notices. This replaces the kick handler's separate after-delivery step, and the join takeover uses it too.

The after-delivery hook stays only for genuinely socket-level work, such as re-arming timers.

**One "accepting guesses" rule.** The showdown accepts guesses while its round is active, the one named, unresolved and at reveal step 0. This becomes a single pure predicate in shared types, next to the phone screen logic. The phone screen's showdown_guessing / showdown_reveal choice and the module's guard both call it.

**Public interface after the change.**
- Removed from the public interface: the connected-socket getter, question-open-for-answering, phase start, active showdown round, showdown reveal step, session settings, and `applyAction` (deleted; its one test drives `applyAdminAction`).
- Made private: `regradeQuestions` and `reloadActiveQuiz`.
- Kept, because REST controllers, connection setup, timer re-arming and the room views need them: session existence, game session id, active quiz id, shown-or-in-progress question ids, the room view, the snapshot, presenter and admin-question context, timer deadlines, session listing and settings update, and the existing event methods (`applyAdminAction`, `quizEdited`, `teamDisconnected`, break end time, display text scale, `bonusChanged` for the REST bonus routes).

**Import reports a quiz change.** When an import updates the active quiz, it calls `quizEdited` with no questions to re-grade. The gateway delivers that outcome, as it does for a live edit. Import is only allowed in its importable statuses, so no re-grade can be needed.

**Handlers.** Each team-event handler becomes "call the event method, return its result". The handler files may be folded into the event declarations where they become one-liners, at the implementer's judgement.

## Testing Decisions

- **One seam: the real-store gateway harness.** Every rule here is tested by sending socket events through the gateway, backed by a real Postgres store, and checking what each room and socket receives. This is the harness the live-session-module spec built and that the current gateway specs already use. No new seam is added, and the module's event methods are not unit-tested directly. They are the code behind the seam.
- **What a good test checks.** Only external behaviour: refusal messages on the sender's socket, emits and their order per room or socket, and the view each room receives after the event. Tests never check which getter or service was called, or the shape of the session record.
- **Behaviour pinned before any code moves.** Every refusal path in the three seat-owning handlers, the showdown guard, the join takeover, kick ordering (notice, then close), and reply-before-broadcast order get a test first, if no spec already covers them. Then the move must keep them all green.
- **Agreement test for the accepting-guesses rule.** One test walks a showdown through its reveal steps. At each step it checks that the phone screen kind is showdown_guessing exactly when a guess from a taking-part team is accepted.
- **Import broadcast.** A test imports into the active quiz in the lobby and checks that all three rooms receive a fresh view.
- **Interface guard.** The existing socket event authorization spec already lists every client-to-server event once. It is extended so that every team-owned event refuses a socket that doesn't own the seat, with the same message.
- **Prior art:** `remaining-events.spec`, `answer-recorded-and-graded.spec`, `showdown-socket.spec`, `team-removed.spec`, `team-connection-presence.spec`, `roster-answer-grading-isolation.spec`, `socket-event-authorization.spec`, and `outcome-delivery-and-timers.spec` for delivery order.

## Out of Scope

- **The REST controllers** (answers listing, bonus award routes, quiz controller) keep using session existence and the game session id. Moving REST bonus awards onto `awardBonus` would be natural follow-up work, but it isn't needed here.
- **Timer deadlines** stay as reads for the gateway's timer re-arming. Folding them into the outcome is a separate change.
- **Serialising writes per session and one standings step** (review candidate 5) and **folding the shallow state utils** (candidate 6, beyond the import entry above) are separate pieces of work.
- **No change to any message, room view, protocol event name or payload shape.** The import broadcast is the only behaviour change visible to users.

## Further Notes

- The **Live session module**, **Session outcome** and **Commit a move** terms are used as defined in `CONTEXT.md` and the earlier live-session-module spec. If "seat" (the team's place in the session that one socket owns) sticks, add it to `CONTEXT.md` in the commit that brings it in.
- `DOCUMENTATION.md` needs one line in its import section: an import into the active quiz now pushes a fresh view to every room.
- This is the review's "worth exploring" tier. Do it after the stronger candidates. It makes later team-facing events (for example a re-link-phone-to-team escape hatch) one method plus one test.
