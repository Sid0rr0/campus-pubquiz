# 02: The write queue can hold several sessions at once

**What to build:** A prefactor so a quiz save can hold the session write of every live session on a quiz at once. The session write queue gains a step that runs one piece of work while holding the queues of several join codes. It waits for each one's earlier writes and blocks their later writes until the work finishes.

Join codes are taken in a fixed order (sorted), so two overlapping holds on the same sessions can't deadlock. Writes to join codes outside the set run as usual. Work that throws releases every held queue and doesn't block the next write, as a single write does today. Nothing calls it yet.

Parent spec: `.scratch/live-edit-save/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A hold on two join codes waits for a write already running on either.
- [ ] A write queued on either join code during the hold runs only after the hold's work finishes.
- [ ] Two holds on the same join codes, started in opposite argument orders, both complete (no deadlock).
- [ ] A write on a join code outside the set isn't held up.
- [ ] Work that throws releases every held queue, and the error reaches the caller.
- [ ] The existing queue spec passes unchanged.
