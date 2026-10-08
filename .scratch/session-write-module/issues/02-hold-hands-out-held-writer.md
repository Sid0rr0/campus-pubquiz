# 02: Holding a quiz's sessions hands out a held writer

**What to build:** A Live edit save that holds a quiz's sessions still applies its quiz edit to each live session exactly as it does today, and its outcome is still delivered after the hold is released. What changes is the path: the edit goes through the Session write module's own `hold` instead of a side door into the commit step.

`hold` takes the join codes to hold and a task. It holds every listed session's queue, using the existing sorted, all-claimed-in-one-tick hold, and gives the task a **held writer**. The held writer's `write` takes the same change and options as the queued `write`, but runs without queueing and ends in the same commit step.

The held writer refuses to write:

- any join code that isn't part of the hold,
- anything at all once the hold has been released.

So a session can't be written outside its queue after the save finishes.

In the game state class:

- Holding a quiz's sessions is built on `hold`. The HeldQuizSessions shape the Live edit module receives is unchanged.
- The quiz-edit step runs through the held writer.
- The temporary unqueued commit from ticket 01 is deleted, so the queued write and the held writer are the commit step's only two callers, both inside the module.

Parent spec: `.scratch/session-write-module/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] The Session write module has no unqueued commit in its interface. The only way to write a session outside its queue is the held writer from an active `hold`.
- [ ] The held writer refuses a join code outside the hold, and refuses every write after the hold is released. Each refusal is an error naming the join code, and nothing is stored.
- [ ] The Live edit module needs no edits, and the HeldQuizSessions shape is unchanged.
- [ ] Every existing backend spec passes without edits, in particular:
  - the session-write spec's quiz edit and re-import cases (a grade or an answer landing while a reload is held, a quiz edit made while a press is held),
  - the live-edit, live-structural-edit, live-edit-regrade, quiz-edited, quiz-reimported and live-edit-delivery-failure specs.
- [ ] If the gateway can cheaply reach "a held writer used after its hold is released is refused", add that gateway-level spec. If it can't, the rule is enforced by the held writer's type and doc comment, and no internal spec is added (the spec's one-seam decision).
- [ ] If `docs/architecture.md` diagrams the game state internals, it shows the Session write module owning the store and the queue, with the Live edit save going through its hold.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
