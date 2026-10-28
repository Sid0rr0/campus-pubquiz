# Spec: One team-seat check for every team event

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-28, candidate 6 ("One team-seat check for team events", rated *speculative*). Follows `.scratch/team-event-gates/` (done), which moved every team event's seat check inside its **session write**. This spec doesn't change where the check runs, only how it is written.

## Problem Statement

Nothing is broken today. Teams, the moderator and the big screen see correct behaviour. The problem is for the developer who writes the next team event.

A team event is only allowed from the socket that holds the team's seat. The change modules check this in two different ways:

- **Claimed team:** submitting an answer, a showdown guess and leaving carry a `teamId` in the payload. The module checks that the session's connected socket for that team is this socket.
- **Socket lookup:** picking a joker, reporting a player count, rating a round and the final feedback form carry no team. The module searches the connected sockets for this socket's team and refuses when it holds none. Disconnect uses the same lookup without refusing.

Both are correct for their events, but nothing says which one a new event should use or why. The lookup lives in a general session-update helper file. The claimed-team comparison is written out by hand in three modules. Each module also writes its own refusal text inline.

Separately, the socket layer keeps per-connection data on each socket (the signed-in user, the session's join code, how many joins it has refused). The socket types don't declare it, so it's read and written through a hand-written cast at six sites. A typo in one of those field names compiles fine and reads `undefined` at runtime.

## Solution

One team-seat check, in the session updates module, that every team event goes through:

- **seat of a socket:** the team whose seat this socket holds, or none. Disconnect uses it as is.
- **require a seat:** the same lookup, but it refuses with the event's own refusal text when the socket holds no seat. When the event names a team, it also refuses if that seat belongs to a different team. It returns the team id the event then acts for.

All seven team events call one of these two. No change module compares connected sockets itself or searches them.

The socket types gain a declared per-connection data shape (user, join code, refused-join count). The game server and socket types carry it, so the six casts go away and a misspelt field fails to compile.

Teams see the same refusals, word for word. Phones still recognise the "not your team" answer refusal and rejoin by themselves.

## User Stories

1. As a team, I want an answer sent from a phone that lost the seat to a rejoin to be refused with the same text as today, so that my phone still rejoins by itself and resends the answer.
2. As a team, I want a showdown guess from a socket that doesn't hold my team's seat to be refused as today, so that only the phone holding the seat can guess.
3. As a team, I want a leave from an old socket to be refused as today, so that it can't remove my team after we reconnected on a new phone.
4. As a team, I want a joker pick from a phone that hasn't joined to be refused with "Join a team before picking a joker", as today, so that I know what to do.
5. As a team, I want a player count, round rating or final feedback from a phone that hasn't joined to be refused with today's text, so that the refusals don't change.
6. As a team, I want an event that names a team other than the one my socket holds the seat for to be refused, so that one phone can't act for another team.
7. As a team, I want my phone's disconnect to free my team's seat as today, and a socket with no seat to disconnect without anything being pushed, so that the big screen's connected marks stay right.
8. As the moderator, I want every team event still checked inside its session write, so that a socket that just lost the seat is refused against the session as the previous write left it.
9. As the moderator, I want kicking a team and setting a team's player count from `/control` to stay unaffected, so that staff actions never need a team seat.
10. As a developer adding a team event, I want one seat check to call, so that I can't pick the wrong one or forget the "names a different team" case.
11. As a developer, I want the seat check to return the team id the event acts for, so that I don't look it up twice.
12. As a developer, I want each event's refusal text kept next to the event and handed to the check, so that the texts phones and specs depend on stay exactly as they are.
13. As a developer, I want no change module to read the connected sockets directly to check a seat, so that the seat rule has one home.
14. As a developer, I want the per-connection socket data declared once in the socket types, so that reading the join code or the user needs no cast.
15. As a developer, I want a misspelt per-connection field to fail `pnpm typecheck`, so that it can't read `undefined` on quiz night.
16. As a developer, I want the existing socket authorization, showdown, joker pick, feedback, player count and team-removed specs to pass unchanged, so that I can trust the refactor didn't change behaviour.

## Implementation Decisions

- **The seat check lives in the session updates module**, which already holds the connected-socket updates (connect, disconnect). It exposes two functions: seat of a socket (team id or none) and require a seat (team id, or a `SessionRefusal`). The existing find-team-by-socket helper becomes the first one and keeps its callers' behaviour.
- **Require a seat takes the refusal text and an optional claimed team id.** Without a claimed team, it refuses when the socket holds no seat. With one, it refuses unless the socket holds that team's seat. Today's claimed-team comparison already refuses in both cases, so the answer, showdown and leave refusals don't change.
- **Refusal texts stay with each event**, word for word. The answer's text stays the shared "not your team" constant that the phone's team link matches on. One text per event is deliberate: the text tells the team what to do for that event. Unifying them isn't the point of this change.
- **Every team event uses the check:** submit answer, showdown guess and leave pass their claimed team id. Joker pick, player count, round rating and final feedback pass none. Disconnect uses seat of a socket. Staff events (kick, set a team's player count, grading, bonus awards) don't change.
- **Where the check runs is unchanged.** It still runs inside the event's session write, in the same order relative to the event's other refusals. For example, an answer to a locked question is still refused as locked before its seat is checked.
- **Other reads stay put.** Reading a team's connected socket to push to it (team syncs, the bonus toast, a kicked notice) isn't a seat check and isn't affected.
- **Typed socket data.** Declare the per-connection data (the signed-in user, the join code, the refused-join count, all optional) once in the socket types, and pass it as Socket.IO's socket-data type parameter to the game server and socket types. Every read and write of a socket's data then uses that type, with no casts.
- **No protocol, payload, snapshot or stored-data change.**
- **Docs.** `CODING_STANDARDS.md` gets one line where it covers team events: a team event checks its seat through the session updates module's seat check, never by reading the connected sockets. `GLOSSARY.md` and `DOCUMENTATION.md` describe behaviour that doesn't change, so they need no edit.

## Testing Decisions

- **Good tests here check behaviour from outside:** a socket emits a team event and gets an acknowledgement (accepted, or refused with a text), checked through the gateway. They don't call the seat check directly.
- **One seam: the real-store gateway specs** (backend, Jest, DB-backed). The socket-event authorization spec is the main prior art: it already drives events from sockets that don't hold the seat and checks the refusal text. The showdown socket, joker pick, set player count, rate round, rate session, send feedback and team-removed specs pin each event's no-seat refusal. All of them must pass unchanged.
- **Add one case if none exists:** an event naming a team other than the one this socket holds the seat for is refused. Answer submission covers it, since it's the claimed-team event phones send most.
- **The typed socket data needs no runtime test.** `pnpm typecheck` is the guard, and the existing connection and broadcaster specs cover the behaviour.
- **Phones:** the team-link seat tests (frontend, Vitest) already pin the answer refusal text that triggers a rejoin. No change there. They pass as long as the text constant is unchanged.

## Out of Scope

- Changing any refusal text, or merging the texts into one.
- Making events that carry a `teamId` stop sending it, or deriving their team from the socket instead.
- Moving where the check runs, or the order of an event's refusals.
- Typing the client-side socket's data, or anything about how phones store their team identity.
- Staff-side authorization (roles, session guard), which the gateway's role checks already cover.

## Further Notes

- The review rated this *speculative*: a small win with nothing wrong today. It pays off the next time a team event is added. If no new team event is planned, it can wait behind the other candidates.
- The two checks are equally correct today. The risk being removed is a future event that carries a `teamId` but uses the lookup, which would let a seated phone act for another team.
