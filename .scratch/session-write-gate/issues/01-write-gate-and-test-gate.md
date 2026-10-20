# 01: The Write gate and the test gate

**What to build:** The expand step. A developer can force two session writes to overlap by holding a write at a named step of the **Session write**, instead of holding whichever service that write happens to await. Nothing about production behaviour changes, and every existing spec keeps passing on the old helpers.

The **Write gate** is a new interface in the live session module. The Session write calls it in two ways:

- **queued(joinCode)**: synchronous, when a write (queued, held or a close) is handed over.
- **reached(step, joinCode)**: awaited at three named steps, typed as a string-literal union:
  - **`hold`**: a Live edit hold owns all its queues and is about to run its task. Reported for each join code in the hold.
  - **`change`**: a write's change has returned and nothing has been stored yet. Both queued and held writes reach it.
  - **`standings`**: just before the live results read. Writes that opt out of the standings read never reach it.

The Session write gets the gate through an optional Nest provider token, following the phase timer schedulers pattern. It defaults to a pass-through gate whose `reached` resolves at once. The queue itself doesn't change.

The real-store harness provides the token with a test gate:

- **holdAt(step, { joinCode? })** holds the next write that reaches that step, for that join code if one is given. It returns a `reached` promise and `release()`. Later writes pass through.
- **nextQueued({ joinCode? })** resolves when the next write is handed over.
- At test end the harness releases every outstanding hold, and fails the test if a `holdAt` was never reached.
- The harness also exposes the Session write provider it already builds.

See the spec's "The Write gate" and "The test gate".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A gate spec through the real-store harness: holding at `change` stops a press before its session is stored (snapshot unchanged), and release finishes it
- [ ] Holding at `standings` stops a bonus award after its change, before its leaderboard changes
- [ ] A `joinCode` filter lets another session's write run freely
- [ ] `nextQueued` resolves for a write queued behind a held one
- [ ] Holding at `hold` stops a Live edit save before its quiz is saved
- [ ] An unreached `holdAt` (e.g. `standings` on a disconnect) fails the test at teardown with a clear message rather than hanging
- [ ] Production wiring provides no gate, and the pass-through default is used
- [ ] Old helpers (`holdNextCall`, `nextWriteWaiting`) still work, and the full backend suite passes
- [ ] `pnpm typecheck` and `pnpm lint` pass
