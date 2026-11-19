# Spec: Each socket event declaration names its session change; the game state pass-throughs go

Status: ready-for-agent

Blocked by: session-change-cleanup. It removes `touchedScores` from the session change every declared change returns, so this spec writes the declared changes once, in their final shape.

Source: architecture review 2026-11-18, candidate 3 ("Collapse the GameStateService and GameGateway pass-throughs into the event declarations"). This narrows the candidate: the gateway's handler methods stay, because the done gateway-handler-template spec made them the one test seam.

## Problem Statement

Adding or changing a client-to-server socket event means passing one call through two modules that add nothing:

- The **gateway** has one handler method per event. Its body hands the parsed payload to an inline function that calls the game state class.
- The **game state class** has one method per event, about 22 that only the gateway calls. Nearly every one is "write this session through this change module" and nothing else.

Each of those modules has an interface as large as its implementation. Since September, 26 of the gateway's 44 commits also touched the game state class, and 44 of the 96 commits to change modules did too. Almost all of those edits are glue: a new event needs a declaration, a gateway body, a game state method and a change module, and a parameter change ripples through all four. One admin event (the quiz master moving a team's side) touched 21 files.

The game state class's constructor also builds all 13 change modules and the move pipeline by hand. To find what an event actually does, a reader goes from the declaration to the gateway, to the game state method, to the constructor to see which change module that is, and only then to the rule.

## Solution

Each socket event declaration names the session change its event makes. The gateway's dispatch step runs that change through the session write for the event's join code. The gateway's handler methods keep their names and decorators, but each body becomes one dispatch call. The 21 gateway-only pass-through methods on the game state class are deleted (join, the 22nd, stays). The change modules are built in one place, shared by the game state class's remaining writes and by the dispatch step.

Quiz masters and teams see no difference: the same payloads are accepted, the same refusals arrive with the same messages, and the same rooms hear the same things. For developers, a new socket event is a declaration that names a change module's method, plus the change module, and the path from event to rule reads in one place.

## User Stories

1. As a quiz master, I want every control panel action to behave exactly as today, so that the refactor costs me nothing on a quiz night.
2. As a quiz master, I want a refused action (Start quiz without sides, leaving a break with ungraded answers) to show the same message as today, so that I know what to fix.
3. As a quiz master, I want an unexpected failure on Advance or Previous to arrive as a refusal with its message, as today, so that my control panel tells me something went wrong.
4. As a quiz master, I want grading an answer, awarding a bonus, setting a team's joker, side or player count, kicking a team and creating a showdown round to behave as today, so that live fixes keep working.
5. As a quiz master, I want the break end time, big-screen text scale and big-screen mute to behave as today, so that the display stays under my control.
6. As a team, I want joining, rejoining, leaving, answering, rating, sending feedback, picking a joker or side, setting my player count, buying a power-up and guessing in a showdown to behave as today, so that playing feels the same.
7. As a team, I want a join refusal to arrive with the same message as today, so that I know whether my team code or name is wrong.
8. As a big-screen display, I want every admin and team event refused from the display room as today, so that the display stays read-only.
9. As any client, I want an invalid payload refused with the same field-specific message as today, so that bugs are easy to diagnose.
10. As an operator, I want the "accepted" log line and its logged fields unchanged, so that the logs read the same.
11. As an operator, I want each event to keep running in its own request context, so that database work in one event never leaks into another.
12. As a developer adding a socket event, I want to write a declaration that names the change and the change module's method, and nothing in the game state class, so that one event is two edits.
13. As a developer, I want a declaration's change typed against its parsed payload, so that a payload/change mismatch fails typecheck.
14. As a developer reading an event, I want the declaration to say which change module method it runs, so that I can go straight from the event to its rule.
15. As a developer, I want the change modules built in one place, so that I can see their dependencies without reading the game state class's constructor.
16. As a developer, I want the game state class to hold only writes with callers other than the gateway (the timer's auto-lock, REST bonus edits, session settings, create, close, join) and the reads, so that its interface says what it is for.
17. As a developer, I want the gateway's handler methods kept as the test seam, so that the existing gateway specs keep working.
18. As a developer, I want a declaration to say whether an unexpected failure becomes a refusal and with what fallback message, so that the admin action's error handling isn't a hidden special case.
19. As a developer, I want join to stay a game state method, so that its write-then-reply steps stay readable and don't overlap the team view work.

## Implementation Decisions

### Declared changes

- A socket event declaration gains an optional **change** entry. It is a function that takes the live session's change modules, the session, the parsed payload and the sending socket's id, and returns the session change the event makes. It is typed against the declaration's schema output, so a mismatch fails typecheck.
- Every declaration whose game state method was a plain session-write pass-through gets a change: admin action (the move pipeline's commit), submit answer, rate round, rate session, send feedback, set player count, pick joker, pick side, buy power-up, submit showdown guess, leave session, grade answer, award bonus, kick team, set team joker, set team side, set team player count, create showdown round, set break end time, set display text scale, set display sound muted.
- A declaration may give a **fallback refusal**: a message used when the change throws something that isn't already a refusal. The admin action declares it with today's message. Declarations without it behave as today: the error reaches the dispatch step's existing generic handling.

### The dispatch step

- When a declaration has a change, the dispatch step runs it through the session write for the event's join code, after validation, session lookup and room authorization (in that order, as today), inside the event's request context. The resulting outcome goes through the existing single delivery step.
- A gateway handler method keeps its subscription decorator and its name. Its body becomes one dispatch call naming its declaration, with no inline function.
- **Join stays as it is**: its declaration has no change, and its handler keeps calling the game state class's join, which writes, then builds the join reply from the stored session and keeps cutting off sockets after refused joins. Connection and disconnection handling are not events and are unchanged.

### The live session change modules

- Building the 13 change modules and the move pipeline moves out of the game state class's constructor into one place (one provider built once, from the same injected stores and the joker random source). The game state class and the dispatch step both use it.
- The change modules' own interfaces are unchanged.

### The game state class

- The 21 gateway-only pass-through methods are deleted.
- It keeps: the timer's advance on expiry, join, disconnect, the REST-called writes (edit bonus, remove bonus, update session settings, create session, close session, rename held session, refresh league tops) and every read (snapshot, presenter context, admin question context, deadlines, session lists, game session id, held and quickfire checks, waiting for idle writes).

### Docs

- `DOCUMENTATION.md`: where it describes how a socket event is handled, say the declaration names the change. No protocol change.
- No new domain term, so `GLOSSARY.md` stays as it is. Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

- Good tests drive an event through the gateway's handler method with a raw payload from a socket in a room, and assert what rooms and sockets received or which refusal came back. They don't assert which change module or declaration was used.
- **One seam, already existing: the gateway's handler methods with the real Postgres store** (the harness the game test suite uses, made the seam by gateway-handler-template). No new seam. Declarations, the dispatch step and the change-module wiring are not tested directly.
- The two test files that call deleted game state methods directly (the move pipeline spec calls the admin action; the team connection presence spec calls join, which stays) move to the gateway handler methods where they call a deleted method.
- The socket event authorization spec keeps passing unchanged: every event is still refused from the wrong room.
- Add one gateway spec: an unexpected failure during an admin action arrives as a refusal with its message, while the same failure in an event without a fallback refusal gets the generic error. This pins the fallback refusal behaviour.
- Every existing gateway spec passes without changing its expectations. A spec that has to change what it expects shows a behaviour change and is a bug in the refactor.
- Run `pnpm crap:changed` and `pnpm --filter backend mutate:db` for the dispatch step and the change-module wiring.

## Out of Scope

- Removing the gateway's handler methods or registering handlers without the subscription decorator. The handler methods are the decided test seam (gateway-handler-template).
- Moving join, disconnect or connection handling into declarations.
- The REST-called writes and the timer's auto-lock. They keep their game state methods.
- A test seam for single change modules without the gateway. The change modules become buildable on their own as a side effect, but this spec adds no tests at that level.
- Changing any change module's rule or interface, the socket protocol, or what any client sees.

## Further Notes

- The architecture review estimated the test churn at "61 + 103 test files". That was wrong: those counts include every read and every handler call. Only one test file (the move pipeline spec) calls a deleted method; the other direct caller uses join, which stays.
- After team-view-projection and transition-rules land, this spec still applies unchanged: it moves where events are routed, not what the changes report.
