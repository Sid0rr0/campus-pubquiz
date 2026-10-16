# 04: Diagnose and fix "You may only submit answers for your own team" after a reconnect

**What to build:** Use the `diagnosing-bugs` skill. After reconnecting, a team's answers were refused with "You may only submit answers for your own team" until the quiz master kicked the team and it rejoined. The refusal means `session.connectedTeamSockets[teamId]` isn't the submitting socket (`answers-changes.ts`). The server's seat handover (`team-roster-changes.ts` `join`/`disconnect`) looks correct on reading, so first reproduce the bug, then fix it.

Hypotheses to test, in order:
1. A page reload while the old socket is still half-open loses `linkedSocketId`. The rejoin then carries no `previousSocketId` and is refused "already connected on another device", but the phone still shows the team's screens from a stored identity and lets the team submit.
2. The phone submits on the new socket before `JOIN_ACCEPTED` lands, because `isLinked` survives from the previous connection.
3. A join refusal on the new socket isn't shown, so the phone looks linked.

Whatever the cause, the phone must never show a submittable answer form while the server says it doesn't hold the seat. On this refusal, the phone should rejoin by itself rather than show the error.

Parent spec: `.scratch/reconnect-resilience/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] A failing test reproduces the refusal (backend real-store harness or e2e)
- [ ] The fix makes it pass, without weakening the one-device-per-team rule
- [ ] An "own team" refusal on the phone triggers a rejoin rather than a dead end
- [ ] The root cause is written up under `## Comments` in this file
