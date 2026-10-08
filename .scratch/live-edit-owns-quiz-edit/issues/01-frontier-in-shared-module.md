# 01: One session's live-edit frontier is worked out in the shared frontier module

**What to build:** The editor's live-edit frontier (the quiz controller's draft response, and the check a save runs against live sessions) is exactly what it is today. What changes is that one session's frontier is worked out by a pure function in the shared live-edit frontier module, beside merging frontiers and the round and question editing rules. All of ADR-0002's frontier rules then live in one module.

The function takes a session value and returns its frontier, with today's rules word for word:

- The opened questions are kept for good.
- The current round is the later of the progress round and the round of the furthest opened question. Previous stepping back never moves the frontier behind an opened question.
- The block has started locking when the status is locking, when the status is in the graded group, or when Previous stepped back before the current round.

The Live edit module calls this function directly, both for its frontier and inside the save. The game state class's frontier method is deleted.

Parent spec: `.scratch/live-edit-owns-quiz-edit/spec.md`

**Blocked by:** None (can start immediately). It doesn't need the session-write-module spec.

**Status:** ready-for-agent

- [ ] The shared live-edit frontier module exports a pure function from a session value to its live-edit frontier. Its rules are unchanged.
- [ ] The Live edit module uses that function. The game state class has no frontier method.
- [ ] Every existing spec passes without assertion edits, in particular:
  - opened-questions (which covers "started locking" and stepping back with Previous), live-edit, live-structural-edit, the live-edit guard spec, the quiz controller spec,
  - the frontend's quiz-draft-state tests.
- [ ] If the mock-based failing-delivery spec still exists when this lands, its fake no longer needs a frontier method. Drop it from the fake, and change nothing else.
- [ ] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
