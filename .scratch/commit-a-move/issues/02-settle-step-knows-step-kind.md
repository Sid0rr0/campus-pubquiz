# 02: The Settle step knows the step kind

**What to build:** The Settle step is told which kind of Move plan step it is settling (or that it is placing a session at creation or restore, in place of today's null action). For a leaderboard rank reveal or hide it leaves the closest_guess reveal sub-step where it was, so the action handler's post-settle patch that put the sub-step back is deleted. Nothing changes on stage: showing or hiding the board mid-way through a closest_guess reveal still resumes the reveal on the same sub-step.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 01 (Agreement walk pins today's preview against the real press)

**Status:** ready-for-agent

- [ ] The Settle step's input carries the step kind; creation and restore pass the "place" kind
- [ ] A leaderboard reveal or hide leaves the closest_guess reveal sub-step unchanged, decided inside the Settle step
- [ ] The post-settle patch in the action handler is gone
- [ ] The closest_guess reveal, advance-under-leaderboard, leaderboard, session-creation and restore specs pass unchanged
- [ ] The 01 agreement walk passes with no new exceptions
