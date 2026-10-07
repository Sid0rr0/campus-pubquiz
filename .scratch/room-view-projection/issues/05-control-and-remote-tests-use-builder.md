# 05: `/control` and `/remote` page tests use the fixture builder

**What to build:** Every page test for this role builds its view with the fixture builder from ticket 02, so it receives what the server would send for the session it describes. Tests take the admin view from the builder and the admin room. The admin game result keeps building the hook result but takes its snapshot from the builder. The copied Advance and Previous status lists are no longer called by any test, and tests under the leaderboard get reveal and hide steps from the real Move plan.

This is one migrate batch of an expand–contract change (about 18 test files). The old helper still exists, so the suite stays green throughout. Tickets 03, 04 and 05 can run in parallel.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] No test in this role's folder builds a view by hand or through the old per-role view helper.
- [ ] Tests describe a quiz and a position, not a snapshot. A test that sets a field on the projected view does so for one field, with a comment saying why the real rules can't reach that state.
- [ ] What each test asserts is unchanged. A test that set the Advance step or Previous state by hand only because the copy couldn't produce it now gets it from the builder. One whose assertion only held because of the copy is corrected to what the server does, and noted in the ticket's comments.
- [ ] The role's pages are not changed in this ticket. Their fallback defaults go in ticket 06.
- [ ] `pnpm typecheck` and the frontend suite pass.
