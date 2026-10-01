# 02: The Settle step knows the step kind

**What to build:** The Settle step is told which kind of Move plan step it is settling (or that it is placing a session at creation or restore, in place of today's null action). For a leaderboard rank reveal or hide it leaves the closest_guess reveal sub-step where it was, so the action handler's post-settle patch that put the sub-step back is deleted. Nothing changes on stage: showing or hiding the board mid-way through a closest_guess reveal still resumes the reveal on the same sub-step.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 01 (Agreement walk pins today's preview against the real press)

**Status:** done

- [x] The Settle step's input carries the step kind; creation and restore pass the "place" kind
- [x] A leaderboard reveal or hide leaves the closest_guess reveal sub-step unchanged, decided inside the Settle step
- [x] The post-settle patch in the action handler is gone
- [x] The closest_guess reveal, advance-under-leaderboard, leaderboard, session-creation and restore specs pass unchanged
- [x] The 01 agreement walk passes with no new exceptions

## Comments

Implemented in the commit titled `refactor(backend): the Settle step knows the step kind` (see git history for the hash). `settleSession` takes `step: { kind: 'place' } | { kind, action }`; leaderboard reveal/hide keep the closest_guess sub-step inside the Settle step and the handler's post-settle patch is deleted. Backend lint, typecheck and the full suite (119 suites, 1101 tests) pass, including the 01 agreement walk with no new exceptions.
