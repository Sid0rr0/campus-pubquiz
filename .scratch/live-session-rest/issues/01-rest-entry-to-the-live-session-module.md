# 01: REST entry to the Live session module

**What to build:** A prefactor that makes every REST route into a live session one call into a new **REST entry** module. Users see no change: every route keeps its path, guards, roles, request and response shapes, status codes and messages.

The REST entry is a new injectable in the game module, beside the Live edit service. It combines the game state service and the Session broadcaster, the way the Live edit service does. It has one method per thing the quiz master does:

- list a team's bonus awards
- edit a bonus award
- remove a bonus award
- list a question's answers with its admin question context
- update session settings and leagues
- close a session, then send the session-closed notice
- refresh league lobbies

For now, editing and removing a bonus award keep today's behaviour inside the module: the bonus service writes, then `bonusChanged` runs and the outcome is delivered. Ticket 02 moves them inside the Session write.

An unknown join code is one typed "unknown live session" error from the module. That covers a code missing up front and a session closed while the request waited in the queue. A shared helper next to the league HTTP mapping turns it into a 404 with today's message. The six inline `hasSession` checks and the sessions controller's "closed meanwhile" re-check go.

The leagues controller's private loop (re-read league tops, broadcast each changed session) moves into "refresh league lobbies". The controllers keep body parsing and validation, guards and the mapping from errors to HTTP status codes.

In `GLOSSARY.md`, the delivery step's entry lists "a REST change" among the things that end there. Today it says "a REST settings change".

See the spec's "A REST entry to the Live session module".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Each of the bonus awards, bonus award mutations, answer, sessions (settings, close) and leagues (update, remove, add and remove session) routes makes exactly one call into the REST entry
- [ ] No controller calls `hasSession`, `getGameSessionId` or the broadcaster directly
- [ ] An unknown join code gets the same 404 message on every one of those routes, including a session closed while the request was queued
- [ ] A blocked close or settings change still gets a 409 with today's message; an invalid bonus edit gets a 400 and a missing award a 404, as today
- [ ] A league write still redraws only the lobbies whose league top changed (`league-top.spec` keeps passing)
- [ ] Controller specs test only HTTP mapping against a stubbed REST entry
- [ ] The real-store harness can build the REST entry from the same providers as production, and a harness spec drives one route's method end to end
- [ ] `GLOSSARY.md` delivery step entry updated
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass
