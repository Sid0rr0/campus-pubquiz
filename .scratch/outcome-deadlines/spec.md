# Spec: Deadline changes travel on the SessionOutcome, and the pass-through socket handlers go

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-07, candidate 9 ("Remove the shallow socket handlers; SessionOutcome carries deadline changes").

## Problem Statement

There are two leftovers in the socket layer, both visible from the gateway.

- **The gateway decides on its own when the auto-lock deadlines change.** The question-lock deadline and the kahoot question deadline are worked out by the Settle step inside the Live session module. The gateway re-arms its two timers only after an admin press and after a timer expiry, by reading both deadlines back out of the module. That is right today only because the Settle step happens to run on presses alone. Nothing says so. If some other event starts moving a deadline (a live edit that resettles, a settings change to the lock grace, a team event), its timer keeps the stale deadline, and the quiz either doesn't auto-lock or locks at the wrong moment on stage. The press handler also carries hand-written "re-arm even if it failed, and even if delivery failed" logic that only it has.
- **Most socket handlers do nothing.** The gateway-handler-template work left one free-function handler per event. Ten of them are a few lines that unpack the event context and call one Live session method. Each one receives a bag of all six injected services plus the server and uses one of them. Deleting them loses nothing, and the services bag exists only to feed them. One more handler (the admin action) is now used only by the timers, and two hold a doc comment or a one-line socket lookup that belongs at the call site.

## Solution

**The SessionOutcome reports deadline changes.** When a Session write leaves the question-lock or kahoot deadline different from the session it started from, the outcome carries the new pair. The one delivery step re-arms the session's timers from it. Any event that moves a deadline gets its timers re-armed through the same path, with no rule in the gateway about which events those are. Presses and timer expiries lose their special re-arm code. Restart restore still arms every restored session's timers at bootstrap, from the restored deadlines.

**The pass-through handlers are deleted.** Each event's body in the gateway calls its Live session method directly. The services bag goes, and so do the injected services the gateway only held to pass on. The admin-action handler goes too: the timer expiry calls the Live session's press and delivers its outcome like any event.

Quiz masters and teams see no difference: the same deadlines, the same auto-locks, the same messages.

## User Stories

1. As a quiz master, I want the last question before a break to auto-lock after the lock grace exactly as today, so that the quiz keeps moving when I'm busy.
2. As a quiz master running a kahoot round, I want each question to auto-lock when its timer runs out exactly as today.
3. As a quiz master, I want Previous back onto a timed question to arm its deadline afresh, as today.
4. As a quiz master, I want a refused press (illegal transition, ungraded answers) to leave the armed timers as they were, so that a refused click never cancels an auto-lock.
5. As a quiz master, I want a press whose delivery to the rooms fails to still leave the timers matching the session, so that a socket hiccup doesn't strand the auto-lock.
6. As a quiz master, I want a timer expiry to behave exactly like my Advance press, including the next deadline it arms.
7. As a quiz master whose backend restarts mid-question, I want the restored deadlines armed straight away, as today.
8. As a quiz master running several sessions, I want each session's timers to follow only that session, as today.
9. As a team, I want answers, joins, leaves, ratings, feedback and showdown guesses to behave exactly as today.
10. As a quiz master, I want grading, kicking, bonus awards, the break end time, the display text size and starting a showdown to behave exactly as today.
11. As a developer adding an event that moves a deadline, I want its timers re-armed without touching the gateway, so that I can't forget.
12. As a developer reading the gateway, I want each event's body to be the one Live session call it makes, so that I don't open a file per event to find out.
13. As a developer, I want the gateway to inject only what it uses, so that its constructor says what the socket layer depends on.
14. As a developer, I want the deadline rule ("timers follow the session's deadlines") stated on the SessionOutcome, so that it's part of the module's interface, not a habit of one handler.
15. As a developer writing a timer test, I want to drive presses and expiries through the real-store harness with the manual scheduler, as today.
16. As a developer, I want the leave-session explanation (an explicit log-out removes the roster row, unlike a disconnect) kept at the call site, so that it isn't lost with the handler file.

## Implementation Decisions

- **The SessionOutcome gains an optional deadline change**: the new question-lock deadline and kahoot question deadline, both epoch-ms or null, present only when the write changed either. The Session write fills it by comparing the session it started from with the session it stores, so no event has to remember to set it. A change that throws stores nothing and reports nothing, which is why a refused press leaves the timers alone.
- **Delivery re-arms first.** The delivery step re-arms the session's timers from the deadline change before any emit, so a failed emit can't leave the timers out of step with a session that was already stored. The ordering doc on the delivery step says so.
- **The timers stay a socket-layer concern.** The two timer registries and their expiry handling stay with the gateway. The delivery step reaches them through a narrow "re-arm this session's timers to these deadlines" dependency that the gateway provides, as it provides the server today. The Live session module still knows nothing about timers.
- **Timer expiry is an ordinary press.** On expiry, the gateway calls the Live session's admin press with Advance and delivers its outcome. That outcome's deadline change arms the next deadline. A failure is logged as today, and the timers stay as the failed write left them. The admin-action handler file goes away.
- **The press handler loses its re-arm logic.** Its body is the Live session call, like every other event.
- **Bootstrap still arms every restored session** from its stored deadlines, since restore doesn't go through a delivered outcome. The gateway's public deadline readers on the Live session module stay for this, and nothing else uses them.
- **Pass-through handlers are deleted:** submit answer, grade answer, kick team, leave session, rate round, send feedback, award bonus, create showdown round, submit showdown guess, and join players. Each body moves into the gateway's dispatch call for that event. Join players keeps its "is this socket still connected" check, read from the server, inline. Leave session's doc comment moves onto the gateway's handler method.
- **The services bag type goes**, with the gateway's injected services that only fed it (team, bonus, feedback, showdown). Anything the gateway still uses (the Live session module, the answer service for delivery, auth sessions, the ORM for request contexts) stays.
- **No behaviour, wire, schema or migration change.**
- **Docs, in the same change:**
  - `DOCUMENTATION.md`: if it describes when auto-lock timers are re-armed, it says they follow the session's deadlines after every change. Otherwise no change.
  - `docs/architecture.md`: diagrams that show socket handler files, or show the gateway re-arming timers after a press, are updated to show the outcome carrying the deadline change.
  - `CODING_STANDARDS.md`: if it describes the per-event handler file convention, it now says an event's body is its Live session call in the gateway.
  - `GLOSSARY.md`: the **Session write** entry gains "and reports any change to the auto-lock deadlines, which the delivery step re-arms".

## Testing Decisions

- **One seam: the real-store gateway harness with the manual timer scheduler.** A good test drives presses, expiries and events through the gateway and asserts which deadlines are armed and what happens when they fire. It never asserts which method re-armed them.
- **Existing specs are the regression net and pass unchanged:** outcome delivery and timers, outcome delivery order, phase timer lifecycle and harness, question-lock auto-advance, countdown and isolation, kahoot question timer and auto-advance, socket event authorization, and every per-event gateway spec. Specs that build the gateway with the removed services drop them from the setup.
- **Tests to add, written against today's code first:**
  - a refused press (Advance out of the break with an ungraded answer) leaves an armed deadline armed. This one passes before and after.
  - a press whose delivery throws still leaves the timers matching the stored session. This passes today through the press handler's `finally`, and must still pass once delivery does the re-arming.
  - a non-press event that changes a deadline gets its timer re-armed. No production event does this today, so this sits at the delivery step's level: an outcome with a deadline change re-arms, and one without leaves the timers alone. That's a test of the delivery step with the manual scheduler, next to the existing delivery-order spec.
- **Prior art:** the manual timer scheduler and phase timer harness for arming and firing deadlines, the outcome delivery order spec for asserting delivery steps, and the session-write spec's `holdNextCall` if a test needs a failure mid-write.

## Out of Scope

- Typing the replies and notices by protocol event. That is the socket-protocol spec. This spec only adds a field to the outcome.
- Moving the timers themselves into the Live session module, or making expiry a Live session event with its own timers.
- Changing when the Settle step runs, or any deadline rule.
- The notify methods REST controllers call on the gateway (settings updated, quiz edited, bonus awards changed, session closed). They already deliver an outcome where they have one. If the live-edit-save spec reroutes the quiz edit, its outcome carries a deadline change for free.
- The guarded dispatch step and the event declarations, which stay as they are.

## Further Notes

- The deadline rule held by accident: only Commit a move and placement run the Settle step, and only presses and expiries deliver their outcomes with a re-arm. Restore re-arms at bootstrap. The live-edit-save spec moves the quiz edit inside held writes, and a later change could resettle there. With this spec in place, that needs nothing extra.
- Closing a session is only allowed at `ended`, where both deadlines are null, so the timers never outlive a session. Nothing changes there.
- The review counted seven pass-through handlers. Counting the three with a trivial extra (join's socket check, leave's comment, grade's argument unpacking) gives ten, plus the admin-action handler the timers use.
