# 02: The Settle step and the dry-run press move to shared types

**What to build:** The **Settle step** moves from the backend into shared types, beside the Move plan, along with the only helpers it uses (the phase timer fields and the leaderboard reveal count). So does the presenter preview's dry-run press (`previewMove`), together with the step that settles a planned press as the action it plans. The dry-run press now takes the time as an argument instead of reading the clock.

Commit a move (real presses, session creation, restart restore) and the presenter preview import all of these from shared types, and the backend keeps no copy. On the night everything behaves exactly as before: every press, timer expiry, restore and /remote "next" line.

See the spec's "The Settle step moves to shared types" and "One dry-run press in shared types" sections.

Parent spec: `.scratch/dry-run-press/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The Settle step's interface is unchanged:
  - it takes the session, the target progress, the step kind (a planned press with its action, or placing a session), the time, and the saved phase timer on restore;
  - it settles the same fields in the same order;
  - it reads no clock.
- [ ] The dry-run press:
  - takes a session, an action and the time;
  - returns the planned move step and the session as the press would leave it;
  - never grades, resolves a showdown, saves, or changes the given session;
  - returns the session unchanged for waiting for grading, a showdown waiting for guesses, and blocked.
- [ ] The presenter preview passes the current time. Commit a move's real press settles with the current time through the same shared settle step.
- [ ] No Settle step, phase timer, leaderboard reveal count or dry-run press code is left in the backend.
- [ ] The phase timer and leaderboard reveal count specs move from the backend's Jest suite to shared types' Vitest suite, with their cases unchanged.
- [ ] These backend specs pass unchanged:
  - the Commit a move spec;
  - the presenter context spec;
  - the join overlay, Previous-to-lobby and action availability specs;
  - every real-store spec that presses through a session.
- [ ] Docs, in the same change: docs/architecture.md says the Settle step lives in shared types with the Move plan and Commit a move calls it, and updates any diagram that places it inside the backend.
- [ ] Typecheck, lint and tests pass.
