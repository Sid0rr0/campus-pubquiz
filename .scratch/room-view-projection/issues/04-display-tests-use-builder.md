# 04: `/display` page tests use the fixture builder

**What to build:** Every page test for this role builds its view with the fixture builder from ticket 02, so it receives what the server would send for the session it describes. Tests take the display view from the builder and the display room. The display helper's copied "between kahoot questions" rule is no longer called by any test.

This is one migrate batch of an expand–contract change (about 10 test files). The old helper still exists, so the suite stays green throughout. Tickets 03, 04 and 05 can run in parallel.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 02

**Status:** done

- [x] No test in this role's folder builds a view by hand or through the old per-role view helper.
- [x] Tests describe a quiz and a position, not a snapshot. A test that sets a field on the projected view does so for one field, with a comment saying why the real rules can't reach that state.
- [x] What each test asserts is unchanged. A test that relied on the copied rule is corrected to what the server does, and noted in the ticket's comments.
- [x] The role's pages are not changed in this ticket. Their fallback defaults go in ticket 06.
- [x] `pnpm typecheck` and the frontend suite pass.

## Comments

Migrated all nine `/display` page tests that built a view (`break`, `completion-and-leaderboard`, `lobby`, `media-rendering`, `question-display`, `question-lock-countdown`, `reveal`, `rules-and-round-intro`, `screen-kind`) to `roomView(SOCKET_ROOMS.DISPLAY, ...)`. No assertion changed. `display-session-picker` and `session-picker-routing` never used the view helper. `__tests__/test-utils.tsx` is no longer imported by any test and is left for the contract ticket to delete. Where the old hand-written fixture disagreed with what the server produces:

- `screen-kind`: the "break with no reviewable question" case used `blockQuestions: []` under status `break`. The server always carries the block there, so the test now puts `revealIndex` past the end of the block, which is what yields the break intro.
- `screen-kind`: the feedback prompt flag was forced through `onAirScreen`. The server derives it from `settings.collectFeedback`, so the tests now set that setting. The screen is no longer overridden anywhere in the file.
- `screen-kind`: "question screen with no current question" is a state the real rules never send (a round always has its question). The test keeps that state by overriding only `currentQuestion` on the projected view, with a comment.
- `completion-and-leaderboard`: the kahoot between-questions test passes `furthestOpenIndex: 0` for the second question. Every kahoot question is its own block, so the builder default (furthest open = question index) is not a reachable position for a kahoot round past its first question. `isBetweenKahootQuestions`, `isCurrentRoundKahoot` and `roundCategory` style fields now come from the projection, not the copied rule.
- `break`: the old fixture said `breakRoundNumbers: [2]` with a block of two questions in round 2, which cannot both hold. The break-intro tests use a quiz where round 1 flows into round 2 (so it is "BREAK 1"); the block-review tests use a quiz where both rounds break so round 2's two questions are the whole block.
- `reveal`: the header test still overrides `header` on the projected view; that is its purpose (the page draws what it is sent), noted in a comment.
