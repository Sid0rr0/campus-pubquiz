# 04: Diagnose and fix "You may only submit answers for your own team" after a reconnect

**What to build:** Use the `diagnosing-bugs` skill. After reconnecting, a team's answers were refused with "You may only submit answers for your own team" until the quiz master kicked the team and it rejoined. The refusal means `session.connectedTeamSockets[teamId]` isn't the submitting socket (`answers-changes.ts`). The server's seat handover (`team-roster-changes.ts` `join`/`disconnect`) looks correct on reading, so first reproduce the bug, then fix it.

Hypotheses to test, in order:

1. A page reload while the old socket is still half-open loses `linkedSocketId`. The rejoin then carries no `previousSocketId` and is refused "already connected on another device", but the phone still shows the team's screens from a stored identity and lets the team submit.
2. The phone submits on the new socket before `JOIN_ACCEPTED` lands, because `isLinked` survives from the previous connection.
3. A join refusal on the new socket isn't shown, so the phone looks linked.

Whatever the cause, the phone must never show a submittable answer form while the server says it doesn't hold the seat. On this refusal, the phone should rejoin by itself rather than show the error.

Parent spec: `.scratch/reconnect-resilience/spec.md`

**Blocked by:** —

**Status:** done

- [x] A failing test reproduces the refusal (backend real-store harness or e2e)
- [x] The fix makes it pass, without weakening the one-device-per-team rule
- [x] An "own team" refusal on the phone triggers a rejoin rather than a dead end
- [x] The root cause is written up under `## Comments` in this file

## Comments

**Root cause: no server defect; the phone had no way to recover once its belief about the seat and the server's disagreed.**

Reading `TeamRosterChanges.join`/`disconnect`, `deliverOutcome`, the write queue and `disconnectClient` found nothing wrong: every write is serialised per session, a takeover closes the old socket and its later disconnect finds the seat already moved, and `heldBy`/`previousSocketId` are checked atomically with the seat update. Hypothesis 2 (submitting on the new socket before `JOIN_ACCEPTED`) is ruled out: `connected` unlinks, and `submitAnswer` refuses while `isLinked` is false. The "own team" refusal cannot be produced from a linked phone by any ordering I could build.

What does reproduce is hypothesis 1/3 in a wider form. The phone only learns the seat is its own from `JOIN_ACCEPTED`, and it names only the one socket it last saw accepted (`linkedSocketId`) as `previousSocketId`. If the server seats a socket whose reply never reaches the phone (the socket died right after the write, the join ack timed out, or a reload lost `linkedSocketId`), the seat is held by a socket the phone cannot name. Every rejoin is then refused "already connected on another device" until the server's ping timeout (~45 s) frees the seat, and:

- the refusal was stored in `joinError` and the join was never sent again, so the phone stayed unlinked forever even after the seat freed;
- a phone that already had a team (`hasTeam`) kept drawing the game screens and the answer form with only a small red line, so submits hit "You're not connected" with nothing the player could fix without reloading;
- the quiz master's kick-and-rejoin was the only thing that recovered it, which is the reported symptom.

Reproduction: a model-based property test (`team-link-seat-convergence.test.ts`) plays the Team link against a model of the server's seat rule over random drops, silently dead sockets, lost replies and late ping timeouts. Before the fix, seed 4 ends unlinked with the seat held by a socket the phone had dropped (socket-1 seated and died; socket-2's join was seated after the phone dropped it; sockets 3 and 4 were refused and never retried). The same model never lets the phone send an answer from a socket without the seat, so the literal "own team" refusal stays a defence in depth rather than a path I could trigger; it is handled anyway.

Fix (phone only; the server rule and protocol are unchanged, so one device per team is not weakened):

- A rejoin refused with the seat-taken message is retried quietly every 3 s on the same connection, up to 20 times, when the phone has already proved who it is (a team in hand or a stored token). A second phone with only the recovery code still sees the refusal at once. Other refusals are shown at once.
- The answer form is offered only while the connection is linked (`useTeamLink` clears `isAnswerable` in the view it hands `/play`).
- An "own team" answer refusal unlinks the phone, rejoins by itself, shows no toast, and resends the answer once the join is accepted.
- The two message texts moved to `@campus-pubquiz/types` (`NOT_YOUR_TEAM_ANSWER_ERROR`, `SEAT_TAKEN_REFUSAL_MARKER`, `isSeatTakenRefusal`) so the server and the phone cannot drift apart.
