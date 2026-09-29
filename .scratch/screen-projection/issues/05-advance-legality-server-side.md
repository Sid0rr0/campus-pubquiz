# 05: Advance/Previous availability decided server-side

**What to build:** The Advance and Previous buttons on /control and /remote are enabled exactly when the server will accept the action. The admin view says whether each is allowed right now. The server derives this from the session's own rounds (including the active block's start position) and the same state machine and intercepts the action handler applies. /control stops rebuilding the block start from a separately fetched quiz list, and the client-side advance-gating helper is deleted. Where restating the rules could drift from the handler, the server works out availability by trying the transition, the way the next-screen preview already does. See the spec ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The admin view carries whether Advance and Previous are allowed. The result matches today's gating in every status, including Previous stopping at the true start of the reveal history, showdown steps after the quiz ends, and a missing earlier status.
- [ ] The block start position comes from the session's rounds, not from the client's quiz list.
- [ ] /control (navigation buttons, mobile admin bar, keyboard shortcuts) and /remote read the admin view's flags.
- [ ] The client-side advance-gating helper and its tests are deleted, and those cases move to projection tests.
- [ ] A projection test shows that for every step of a whole-quiz walk, "Advance allowed" matches whether the action handler accepts ADVANCE, and the same for PREVIOUS.
- [ ] The /control advance-controls, previous-button and keyboard-shortcut tests, and the /remote page tests, pass on admin view fixtures.
