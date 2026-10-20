# 04: Delete the old overlap helpers

**What to build:** The contract step. Once no spec uses them, the harness no longer offers the service-holding helper, the private queue-run swap or `nextWriteWaiting`. The harness's doc comments explain how to force an overlap with the Write gate (`holdAt`, `nextQueued`, `settled`), so the next ordering test is written that way. If `docs/architecture.md` lists the Session write's collaborators, it gains one line on the gate.

`rejectNthCall` stays, because failure tests still use it.

See the spec's "Migrating the specs" and "Docs".

**Blocked by:** 02 (Migrate the session-write spec), 03 (Migrate the other ordering specs)

**Status:** ready-for-agent

- [ ] `holdNextCall`, its `HeldCall` type, the queue-run swap and `nextWriteWaiting` are gone from the harness
- [ ] The harness no longer reaches any private field of the game state service or the Session write
- [ ] Harness docs describe forcing an overlap with the gate
- [ ] `docs/architecture.md` updated if it lists the Session write's collaborators
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass
