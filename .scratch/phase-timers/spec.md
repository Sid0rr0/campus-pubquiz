# Spec: Phase timers are their own module, apart from the gateway

Status: ready-for-agent

## Problem Statement

A live session has two auto-lock timers:

- the **question lock**, which advances the quiz once the last question of a block has been open for the lock grace period
- the **kahoot question deadline**, which locks a kahoot question once its time runs out

Both depend only on the session's deadlines. Today they live in the game gateway, next to fourteen socket handlers and the controller notify methods. The gateway:

- builds two timer registries from an optional scheduler injection token
- re-arms both whenever an outcome reports a deadline change
- restores both for every session at bootstrap, after a backend restart
- clears both on shutdown
- turns an expiry into an Advance press, delivered like any event, with the failure logged since there's no client to tell

A developer working on the timers has to read the socket gateway to find them. A developer working on the socket handlers scrolls past timer code they don't need. The scheduler seam already has two adapters, the real scheduler and the manual one the real-store harness uses, but the code that uses it is mixed into the gateway's other concerns.

## Solution

A **Phase timers** module owns both auto-lock timers for every live session. Its interface is small:

- **arm** a session's timers to its deadlines (a null deadline clears that timer)
- **restore** the timers for every stored session
- **clear** every timer

On expiry it presses Advance through the Live session and hands the outcome to delivery, which is the path an admin press takes.

The gateway keeps its socket handlers and notify methods. It builds the Phase timers module with the schedulers it is given, wires the outcome delivery's re-arm step to the module's arm, and calls restore at bootstrap and clear at shutdown.

Nothing changes in the room: the timers fire at the same moments, with the same effects and logs.

## User Stories

1. As a quiz master, I want the last question of a block to lock and advance on its own once the lock grace period runs out, so that the quiz moves on if I'm busy.
2. As a quiz master, I want a kahoot question to lock on its own when its timer ends, so that kahoot rounds keep their pace.
3. As a quiz master, I want an auto-lock to behave exactly as if I had pressed Advance, so that the screens, grading and progress are identical either way.
4. As a quiz master, I want a timer re-armed whenever a press, an edit or a settings change moves its deadline, so that the countdown on screen and the real lock agree.
5. As a quiz master, I want a timer cleared when its deadline goes away, so that the quiz never advances on a deadline that no longer applies.
6. As a quiz master, I want the timers restored for every running session after a backend restart, so that a countdown in progress still locks.
7. As a quiz master, I want one session's timers kept apart from another's, so that two quizzes running at once never advance each other.
8. As a quiz master, I want a failed auto-advance logged without crashing the backend, so that one failure doesn't stop the night.
9. As a quiz master, I want a failed auto-advance to leave the timers as the failed write left them, so that a refused press doesn't arm a phantom deadline.
10. As a team, I want an answer sent in the last second before the lock to be handled as before, so that the timing stays fair.
11. As an operator, I want every timer cleared on shutdown, so that a stopping backend doesn't fire into a closed database.
12. As a backend developer, I want both auto-lock timers in one module named after what they are, so that I can find them without reading the socket gateway.
13. As a backend developer, I want the gateway to hold only socket handlers, connection handling and notify methods, so that its job is one thing.
14. As a backend developer, I want the Phase timers module to own the scheduler seam, so that the real and manual schedulers plug into the code that uses them.
15. As a backend developer, I want an expiry handled inside its own request context, so that its database work is isolated as a socket event's is.
16. As a backend developer, I want the real-store harness to keep injecting manual schedulers the same way, so that every timer spec keeps reading and firing deadlines without waiting.
17. As a backend developer, I want every existing timer and gateway spec to pass unchanged, so that I know the move kept every behaviour.

## Implementation Decisions

- **New Phase timers module (backend, game area), a plain class.** It is not a Nest provider. The gateway constructs it, as it constructs the two timer registries today.
- **Constructor dependencies:** the lock and kahoot schedulers (optional; real schedulers when absent), the Live session (to press Advance, list sessions and read deadlines), the ORM (to open a request context per expiry), a deliver function (to hand an expiry's outcome to the outcome delivery step, which needs the gateway's server), and a logger.
- **Interface:**
  - **arm(joinCode, deadlines):** re-arms both timers to the deadline change (question lock at, kahoot question ends at), clearing stale ones first. A null deadline clears that timer.
  - **restoreAll():** arms every stored session to its current deadlines.
  - **clearAll():** clears every timer.
- **Expiry behaviour, unchanged:**
  - Each expiry runs in a fresh request context, presses Advance through the Live session, and hands the outcome to delivery. Delivery re-arms through the same module, from the outcome's deadline change.
  - A failure is logged with the timer's label ("Auto-lock" or "Kahoot auto-lock") and leaves the timers as the failed write left them.
- **The scheduler seam moves with it.** The injection token and the schedulers type move to the Phase timers module. The gateway still reads the optional token and passes it through, so the real-store harness keeps building the gateway with manual schedulers. The timer registry stays as the module's internal per-session building block, with its existing unit spec.
- **The gateway after the move:**
  - It keeps its socket handlers, connection and disconnect handling, dispatch and controller notify methods.
  - The outcome delivery's re-arm step calls Phase timers' arm.
  - Bootstrap calls restoreAll, and module destroy calls clearAll.
  - Its own expiry handlers, Advance-from-timer and arm-timers methods are deleted.
- **No changes outside the gateway and the new module:** none to the Live session, outcome delivery, the Session write, the socket protocol or the shared types. The open session-write-module and live-session-changes specs don't touch the gateway's timer code, so this work doesn't conflict with them.

## Testing Decisions

- **A good test drives the gateway through the real-store harness and asserts what the room sees:** whether a timer is armed, its due time, and what happens when it fires (snapshots, progress, grading, logs). It never imports the Phase timers module.
- **No new seams.** The gateway, driven through the real-store harness with its lock and kahoot timer controls on manual schedulers, is the only test surface. These specs pass unchanged:
  - phase timer harness
  - question lock auto-advance
  - kahoot question auto-advance
  - question lock timer isolation
  - outcome delivery and timers
  - last-second answer
  - session write
  - the rest of the gateway specs
- **The timer registry's unit spec stays as is.** It covers re-arming, null, clear-all, expire-once, the exact deadline and isolation, on both schedulers.
- **No Phase timers unit spec.** Its behaviour is fully observable through the gateway seam. A gap found while moving code is added as a gateway-level spec.

## Out of Scope

- Any change to when or how the timers fire, or what an expiry does.
- Making Phase timers a Nest provider or injecting it elsewhere.
- Changing the outcome delivery step, the Settle step or how deadlines are reported on the outcome.
- Changing the socket handlers, the dispatch path or the controller notify methods.
- The other candidates in the 2026-10-08 architecture review.

## Further Notes

- Source: candidate 6 of the 2026-10-08 architecture review ("Splitting the long files"), rated "Worth exploring". Expected result: the gateway loses its timer section and the scheduler token, and the scheduler seam sits with the code that uses it.
- The gateway handlers stay because the NestJS decorators require them, as the review notes.
- If "Phase timers" is a name worth keeping in the domain language, add it to `GLOSSARY.md` in the same commit (for example: the question lock and kahoot question timers, armed from a session's deadlines).
