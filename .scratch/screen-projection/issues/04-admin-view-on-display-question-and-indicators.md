# 04: Admin view: the question on display and the round indicators

**What to build:** /control's grading panel defaults to the question the big screen is showing, and the question browser's round-title and break indicators light up for what's on air. /control reads all of this from the admin view instead of re-deriving it from the status and the reveal index. The admin's manual grading pick, and how it snaps back when the display catches up, stays local page state. See the spec ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The admin view carries the on-display question id during question open, locking, break and reveal, and null elsewhere, taken from the named screen.
- [ ] The admin view carries the round index whose title card is on air (round intro, reveal intro, break round intro) and the round index whose break indicator is lit (break intro, break, break round intro).
- [ ] /control's own on-display question, title-round and break-round derivations are deleted. It renders from the admin view.
- [ ] The manual grading pick keeps today's behaviour: it sticks until the displayed question comes round to it.
- [ ] Projection tests assert these fields across a whole-quiz walk. The grading question-browsing tests for /control pass on admin view fixtures.
