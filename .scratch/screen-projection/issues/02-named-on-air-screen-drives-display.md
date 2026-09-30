# 02: Named on-air screen drives the big screen

**What to build:** The display view names the screen on air: lobby, rules, round overview, round title, question, locking, break intro, break review, break round title, reveal intro, reveal, leaderboard, ended or showdown. With it comes the question or round that screen is about, resolved once while the round index stays pinned during break and reveal. The view also says whether the between-kahoot-questions leaderboard is showing, using ticket 01's rule. /display takes its transition key, header content and between-kahoot animation flag from the view, and stops computing them itself. Nothing visible on the big screen changes. See the spec ([spec](../spec.md)).

**Blocked by:** 01

**Status:** done

- [x] The projection computes the named screen as a discriminated value (screen kind plus its question or round), included in the display and admin views.
- [x] The display view carries a transition key that changes only when what's on screen changes, matching today's keys, including the closest_guess reveal step and the showdown step.
- [x] The display view carries the header's label, title and badge. In break review and reveal they match the round of the question on screen.
- [x] The display view carries a between-kahoot-questions flag built on the shared hidden-behind-leaderboard rule.
- [x] /display's own screen-key, header and between-kahoot derivations are deleted. It renders from the view.
- [x] Projection tests walk a whole quiz (normal block, kahoot round, closest_guess reveal, showdown, and Previous back through break and reveal) and assert the named screen and its question or round at each step.
- [x] The display page tests pass on per-audience view fixtures, and the display's previous-leaderboard animation capture stays local page state.

## Comments

Implemented in the commit adding `on-air-screen.ts` (`shared/types/src/`) and the display/admin branches of `projectScreen`. The named-screen rule lives in shared types as a pure function so `/display` test fixtures can build views with the same rule the backend uses (`displayView` in `display/__tests__/test-utils.tsx`); the page itself never calls it. `isBetweenKahootQuestions` is computed in the projection from ticket 01's rule, limited to `question_open` so the board over a locking or round-intro question behaves as before. Tests: `on-air-screen.spec.ts` (normal block forward and back through break and reveal, kahoot board, closest_guess sub-steps, showdown) plus a display page test that the header comes from the view. Full backend, frontend and shared-types suites, lint and tsc pass. Status set to `done`.
