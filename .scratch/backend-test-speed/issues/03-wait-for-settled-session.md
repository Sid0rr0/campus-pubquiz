# 03: Gateway specs wait for a settled session instead of sleeping

**What to build:** A gateway spec can wait until everything in flight for its session has been written, then assert on what the big screen, `/control` and the phones were sent. It no longer sleeps a fixed 100–300ms and hopes. The session write spec stops taking 92s, and its race tests come out the same way on every run.

The **session write** queue gets a read-only way to wait for a join code to go idle: a promise that resolves once every write queued for that join code, and any write those writes queue, has finished, whether it stored, was refused or threw. It only observes the queue and changes nothing about ordering or production behaviour. The real-store gateway harness exposes it as `settled()` on the game handle. It resolves once the queue is idle and pending microtasks have flushed, so broadcasts sent at the end of a write have been recorded.

The session write, session room scoping, state transitions and quiz service specs replace their fixed sleeps and poll-then-sleep helpers with `settled()`. Where a test needs to control ordering, they use the existing hold-a-call helper (`holdNextCall`).

Parent spec: `.scratch/backend-test-speed/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Written first, next to the existing session write queue tests: the idle wait resolves immediately when nothing is queued; waits for a running write; waits for a write queued behind it; still resolves when a queued write throws; doesn't wait for another join code's writes.
- [ ] `settled()` on the real-store harness, documented in the harness next to `holdNextCall`.
- [ ] No fixed-duration sleep is left in the four specs named above. Each race test still fails against code without the session write (check one by temporarily bypassing the queue, then restore it).
- [ ] The session write spec takes under 15s on its own.
- [ ] The four specs pass 20 runs in a row (`--testPathPattern` loop) with no failures.
- [ ] Production session write behaviour is unchanged. The existing session write and live session specs pass unchanged.
