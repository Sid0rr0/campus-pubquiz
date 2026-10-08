# 01: Phase timers module takes the auto-lock timers out of the gateway

**What to build:** Move the question lock and the kahoot question deadline timers out of the game gateway into a Phase timers module (see [spec](../spec.md)). Nothing changes in the room:

- a block's last question still locks and advances once the lock grace period runs out
- a kahoot question still locks when its timer ends
- timers are re-armed whenever an outcome moves a deadline, and cleared when a deadline goes away
- timers are restored for every running session after a restart and cleared on shutdown
- a failed auto-advance is still logged ("Auto-lock" or "Kahoot auto-lock") and leaves the timers as the failed write left them

The Phase timers module is a plain class the gateway builds, not a Nest provider. Its dependencies:

- the optional lock and kahoot schedulers
- the Live session
- the ORM
- a deliver function from the gateway
- a logger

Its interface:

- **arm(joinCode, deadlines):** re-arms both timers to a deadline change; a null deadline clears that timer.
- **restoreAll():** arms every stored session to its current deadlines.
- **clearAll():** clears every timer.

Each expiry runs in a fresh request context, presses Advance through the Live session and hands the outcome to delivery, which re-arms through the same module.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Phase timers module exports the class, the scheduler injection token and the schedulers type. The timer registry stays as its internal per-session building block.
- [ ] The gateway still reads the optional scheduler token and passes it to the module. The real-store harness builds the gateway with manual schedulers exactly as before, with no harness changes beyond import paths.
- [ ] The gateway wires the outcome delivery's re-arm step to the module's arm, calls restoreAll at bootstrap and calls clearAll on module destroy.
- [ ] The gateway's expiry handlers, Advance-from-timer method, arm-timers method and timer registries are deleted. It keeps its socket handlers, connection handling, dispatch and notify methods.
- [ ] No changes to the Live session, outcome delivery, the Session write, the socket protocol or the shared types.
- [ ] These pass unchanged:
  - the timer gateway specs: phase timer harness, question lock auto-advance, kahoot question auto-advance, question lock timer isolation, outcome delivery and timers, last-second answer, and session write
  - the rest of the gateway specs
  - the timer registry spec
- [ ] `pnpm --filter backend test` and `pnpm typecheck` pass.
