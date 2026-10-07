# 05: `/control` and `/remote` page tests use the fixture builder

**What to build:** Every page test for this role builds its view with the fixture builder from ticket 02, so it receives what the server would send for the session it describes. Tests take the admin view from the builder and the admin room. The admin game result keeps building the hook result but takes its snapshot from the builder. The copied Advance and Previous status lists are no longer called by any test, and tests under the leaderboard get reveal and hide steps from the real Move plan.

This is one migrate batch of an expand–contract change (about 18 test files). The old helper still exists, so the suite stays green throughout. Tickets 03, 04 and 05 can run in parallel.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 02

**Status:** done

- [x] No test in this role's folder builds a view by hand or through the old per-role view helper.
- [x] Tests describe a quiz and a position, not a snapshot. A test that sets a field on the projected view does so for one field, with a comment saying why the real rules can't reach that state.
- [x] What each test asserts is unchanged. A test that set the Advance step or Previous state by hand only because the copy couldn't produce it now gets it from the builder. One whose assertion only held because of the copy is corrected to what the server does, and noted in the ticket's comments.
- [x] The role's pages are not changed in this ticket. Their fallback defaults go in ticket 06.
- [x] `pnpm typecheck` and the frontend suite pass.

## Comments

Migrated the `/control` and `/remote` page tests, and `use-admin-session.test.ts` (it built an admin snapshot through the old helper), to the fixture builder. `adminGameResult` now takes a `session` description and builds its snapshot with the builder; the old `adminView` and `progress` helpers in `app/control/__tests__/test-utils.tsx` are left for the contract ticket. `use-admin-keyboard-shortcuts.test.ts` and `use-admin-game.test.ts` take hook options and socket payloads, not views, and are unchanged.

Builder additions (all additive, in `test-utils/room-view.ts`): `joinCode`, `displayTextScale`, `connectedTeamIds`, `ungradedQuestionIds` and `phaseTimer`, each pinned in `room-view.test.ts`.

Assertions corrected to what the server does:

- `keyboard-shortcuts.test.tsx`, "ignores ArrowRight and ArrowLeft while the board is up": the fixture used a `break` with the board visible and announced Advance `none`. The real Move plan never announces `none` under the board outside `ended`: with every rank shown it announces `hide_leaderboard`. The test now uses `ended` with the board visible and a `previousStatus`, which gives Advance `none` and Previous covered, as its name says.
- Question and team ids are numbers, as the server sends them, where the fixtures used strings such as `'r1q1'` and `'team-1'`. Assertions on those ids (`fetchAnswers`, `focusAnswersQuestionId`) and the hand-written live-answers payloads follow.
- `bonus-award-confirmation.test.tsx`: a `break` now carries its block's questions (the old fixture had none), so the page loads their answers; the test mocks `fetchAnswers` like the grading tests do. Assertions unchanged.
- `server-decided-flags.test.tsx`: the two flags now come from the position (last question before the break; an ungraded question in the final round) instead of being set by hand.
