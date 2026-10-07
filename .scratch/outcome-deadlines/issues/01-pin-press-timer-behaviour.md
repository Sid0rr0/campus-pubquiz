# 01: Pin the timer behaviour a press must keep

**What to build:** Two tests that pin how the auto-lock timers react to a press that doesn't go cleanly. Ticket 02 moves re-arming from the press handler into the delivery step, and these are the two cases that move could break. Both are driven through the real-store gateway harness with the manual timer scheduler, and both pass against today's code. Only tests change.

- **A refused press leaves the armed deadline armed.** With a deadline armed, the quiz master presses Advance and it is refused (for example, Advance out of the break with an ungraded answer, or an illegal transition). The same deadline is still armed afterwards, and firing it advances the quiz as usual.
- **A press whose delivery fails still leaves the timers matching the session.** A press is applied and stored, then delivering its outcome to the rooms throws. The armed deadlines are the ones the stored session now holds.

Parent spec: `.scratch/outcome-deadlines/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] Both tests assert on which deadlines are armed and what firing them does, never on which method re-armed them.
- [ ] They sit next to the existing outcome delivery and timers spec, reusing the manual scheduler and phase timer harness.
- [ ] Both pass against today's code, without any production change.
