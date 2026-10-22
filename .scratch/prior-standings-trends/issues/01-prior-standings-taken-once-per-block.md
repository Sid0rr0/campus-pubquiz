# 01: Prior standings taken once per block, by a rule in shared types

**What to build:** The rule that decides when the **Prior standings** are taken moves from the backend's per-field session updates into shared types, beside the leaderboard description that reads them. The rule itself changes: the Prior standings are taken only by the write that first puts the block in play's first question in front of the teams for that block, and they carry the block they were taken for (identified by its first question id).

A quiz master sees nothing different:

- in a kahoot round every question is its own block, so the arrows and the count-up board behave exactly as today;
- ordinary-block arrows still use the round back-out until ticket 02.

See the spec's "When the Prior standings are taken" section.

Parent spec: `.scratch/prior-standings-trends/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The rule is one pure function in shared types: given the session a write started from and the session it ends with, it returns the session with its Prior standings brought up to date. It takes them, from the leaderboard the write started from, only when all three hold:
  - the question is being answered after the write and wasn't before, and the write isn't stepping back into it out of a graded status (today's opening test);
  - it is the first question of the block in play for the new progress, asked through the Block module;
  - the Prior standings aren't already this block's.
- [x] The session record carries the block the Prior standings were taken for, alongside them. It is empty in a fresh or restored session.
- [x] The Session write applies the rule once per write, before the standings are re-read, as today. The backend's own copy of the rule is deleted.
- [x] Each of these takes nothing:
  - opening the first question of a later round in the same block;
  - Previous from the block's first question back to its round intro, then Advance again;
  - toggling the leaderboard or the join overlay over a question being answered;
  - after a restart, opening a question that isn't a block's first.
- [x] The prior standings and leaderboard description real-store specs pass unchanged, including every kahoot case, the restart case and the ordinary-block cases.
- [x] Typecheck, lint and tests pass.
