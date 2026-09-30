# 04: Admin view: the question on display and the round indicators

**What to build:** /control's grading panel defaults to the question the big screen is showing, and the question browser's round-title and break indicators light up for what's on air. /control reads all of this from the admin view instead of re-deriving it from the status and the reveal index. The admin's manual grading pick, and how it snaps back when the display catches up, stays local page state. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** done

- [x] The admin view carries the on-display question id during question open, locking, break and reveal, and null elsewhere, taken from the named screen.
- [x] The admin view carries the round index whose title card is on air (round intro, reveal intro, break round intro) and the round index whose break indicator is lit (break intro, break, break round intro).
- [x] /control's own on-display question, title-round and break-round derivations are deleted. It renders from the admin view.
- [x] The manual grading pick keeps today's behaviour: it sticks until the displayed question comes round to it.
- [x] Projection tests assert these fields across a whole-quiz walk. The grading question-browsing tests for /control pass on admin view fixtures.

## Comments

Implemented in the commit adding `describeAdminIndicators` (`shared/types/src/on-air-screen.ts`) and the admin branch of `projectScreen`. The admin view carries `onDisplayQuestionId`, `titleCardRoundIndex` and `breakRoundIndex`. They are read from the screen that would be on air with the leaderboard hidden, so they keep marking the underlying content while the board is up, exactly as the old status-based derivations did (a literal read of the named screen would have gone blank under the board). /control reads the three fields and the manual grading pick stays local state. Tests: a whole-quiz indicator walk, break review via Previous and the leaderboard-cover case in `on-air-screen.spec.ts`; the control page tests now build admin view fixtures through `adminView` in `control/__tests__/test-utils.tsx`. Full backend, frontend and shared-types suites, lint and tsc pass. Status set to `done`.
