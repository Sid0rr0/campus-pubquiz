# 05: Join is a module event

**What to build:** A team joining (or rejoining) goes into the Live session module as one event, with the sender's socket and a liveness check from the socket layer. Only the socket layer knows whether a socket is still connected, so it passes the check in; the takeover rule itself lives in the module. Inside, the module:

- joins through the team service
- applies the seat takeover rule: a live socket already holding the seat refuses the join, unless the request names that socket as its previous one, in which case the old socket is listed to close
- lists the roster and records the connection
- returns "join accepted", with saved answers and bonus awards, as a reply to the sender

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** done

- [x] A second device joining as a team whose phone is still connected is refused with today's "already connected on another device" message.
- [x] A phone rejoining on a fresh socket that names its previous socket takes the seat, and the old socket closes.
- [x] A rejoining team gets its saved answers and bonus awards in the join reply, before the room-wide update.
- [x] A new team appears on the roster and leaderboard at zero points.
- [x] Reconnect resync is unchanged: the rejoined phone gets the full current players view.

## Comments

Implemented in the commit `refactor(backend): join is a Live session module event` (find it in git history; no hash recorded here).

- `GameStateService.teamJoined(joinCode, request, socketId, isSocketLive)` joins through the team service, applies the seat takeover rule inside the session write (so two joins racing for one seat can't both pass), records the connection and roster, and returns the join reply (saved answers, bonus awards, ratings, feedback) as a reply plus the taken-over socket in `socketsToClose`. Failures from the team service become `SessionRefusal`s with the same messages. `GameStateService` now also takes `BonusService` and `FeedbackService`. `join-players.handler.ts` is a one-line adapter passing the socket layer's liveness check.
- The only behaviour change: a taken-over socket now closes after the new seat is recorded and the room push goes out, not before. Its disconnect then finds no seat and does nothing.
- Takeover, refusal, rejoin and leaderboard rules were already pinned by `join-players.spec.ts`, `team-connection-presence.spec.ts` and `admin-actions.spec.ts`; added the missing "join reply before the room-wide update" test first.
- `getConnectedSocketId` has no callers left; it goes in ticket 08.
