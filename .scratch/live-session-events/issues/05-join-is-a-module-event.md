# 05: Join is a module event

**What to build:** A team joining (or rejoining) goes into the Live session module as one event, with the sender's socket and a liveness check from the socket layer. Only the socket layer knows whether a socket is still connected, so it passes the check in; the takeover rule itself lives in the module. Inside, the module:

- joins through the team service
- applies the seat takeover rule: a live socket already holding the seat refuses the join, unless the request names that socket as its previous one, in which case the old socket is listed to close
- lists the roster and records the connection
- returns "join accepted", with saved answers and bonus awards, as a reply to the sender

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A second device joining as a team whose phone is still connected is refused with today's "already connected on another device" message.
- [ ] A phone rejoining on a fresh socket that names its previous socket takes the seat, and the old socket closes.
- [ ] A rejoining team gets its saved answers and bonus awards in the join reply, before the room-wide update.
- [ ] A new team appears on the roster and leaderboard at zero points.
- [ ] Reconnect resync is unchanged: the rejoined phone gets the full current players view.
