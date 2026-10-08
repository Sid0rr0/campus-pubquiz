# 02: The failing-delivery spec runs on the real store

**What to build:** "A quiz edit that fails part-way still delivers what already landed, and the quiz master sees the save's own error" is proved against the real store, not against a fake game state class. This is a prefactor for ticket 04. Today's spec hand-writes the game state class's hold, live-session list and frontier, which are exactly the members ticket 04 removes. Moving the spec first means ticket 04's move is covered by a test that doesn't depend on those internals.

The new spec runs on the real-store harness:

1. Two sessions are live on the same quiz.
2. A quiz edit is saved through the Live edit module.
3. The second session's quiz reload is made to fail, using the hold-next-call helper (or an equivalent one-shot rejection) on the seed service's reload.
4. Outcome delivery is made to fail.

It asserts that:

- the save rejects with the reload's own error, not the delivery error,
- delivery was still attempted for the first session, which reloaded before the failure.

The mock-based version is deleted.

Parent spec: `.scratch/live-edit-owns-quiz-edit/spec.md`

**Blocked by:** None (can start immediately). It doesn't need the session-write-module spec.

**Status:** ready-for-agent

- [ ] A real-store spec covers the scenario above and passes against today's code.
- [ ] The mock-based failing-delivery spec is deleted. No spec in the repo builds a fake game state class for the Live edit module.
- [ ] If the harness needs a small addition (for example, a one-shot rejection on a service call), it lives with the existing harness helpers and is reusable.
- [ ] Every other spec passes unchanged.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
