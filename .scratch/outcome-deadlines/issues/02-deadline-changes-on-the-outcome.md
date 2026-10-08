# 02: Deadline changes travel on the SessionOutcome

**What to build:** The auto-lock timers follow the session's deadlines after every change, not just after a press. When a Session write leaves the question-lock deadline or the kahoot question deadline different from the session it started from, the SessionOutcome carries the new pair. The delivery step re-arms that session's timers from it, before any emit. A write that throws stores nothing and reports nothing, so a refused press leaves the timers alone.

- The gateway provides the timers to the delivery step through one narrow "re-arm this session's timers to these deadlines" dependency. The Live session module still knows nothing about timers.
- A timer expiry calls the Live session's Advance press and delivers its outcome like any event, and that outcome arms the next deadline. A failure is logged as today.
- The press handler loses its "re-arm even on failure" code, and the admin-action handler used only by the timers goes away.
- Bootstrap still arms every restored session from its stored deadlines.

Quiz masters see no difference: same deadlines, same auto-locks.

Parent spec: `.scratch/outcome-deadlines/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] The SessionOutcome has an optional deadline change, filled only by the Session write's before/after comparison. No event sets it by hand.
- [ ] The delivery step re-arms from it before any emit, and its ordering doc says so.
- [ ] A new delivery-step test with the manual scheduler: an outcome with a deadline change re-arms that session's timers, and one without leaves them alone.
- [ ] Ticket 01's tests and the existing timer and delivery specs pass unchanged: outcome delivery and timers, outcome delivery order, phase timer lifecycle and harness, question-lock auto-advance, countdown and isolation, kahoot question timer and auto-advance.
- [ ] Nothing in the gateway re-arms timers except bootstrap and the dependency it gives delivery.
- [ ] `GLOSSARY.md`'s **Session write** entry says the write reports any change to the auto-lock deadlines, which the delivery step re-arms. `DOCUMENTATION.md` and `docs/architecture.md` are updated where they describe re-arming after a press.
- [ ] `pnpm typecheck` and the backend suite pass.
