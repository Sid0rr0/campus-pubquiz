# 05: Advance/Previous availability decided server-side

**What to build:** The Advance and Previous buttons on /control and /remote are enabled exactly when the server will accept the action. The admin view says whether each is allowed right now. The server derives this from the session's own rounds (including the active block's start position) and the same state machine and intercepts the action handler applies. /control stops rebuilding the block start from a separately fetched quiz list, and the client-side advance-gating helper is deleted. Where restating the rules could drift from the handler, the server works out availability by trying the transition, the way the next-screen preview already does. See the spec ([spec](../spec.md)).

**Blocked by:** 01

**Status:** done

- [x] The admin view carries whether Advance and Previous are allowed. The result matches today's gating in every status, including Previous stopping at the true start of the reveal history, showdown steps after the quiz ends, and a missing earlier status.
- [x] The block start position comes from the session's rounds, not from the client's quiz list.
- [x] /control (navigation buttons, mobile admin bar, keyboard shortcuts) and /remote read the admin view's flags.
- [x] The client-side advance-gating helper and its tests are deleted, and those cases move to projection tests.
- [x] A projection test shows that for every step of a whole-quiz walk, "Advance allowed" matches whether the action handler accepts ADVANCE, and the same for PREVIOUS.
- [x] The /control advance-controls, previous-button and keyboard-shortcut tests, and the /remote page tests, pass on admin view fixtures.

## Comments

Implemented in the commit adding `apps/backend/src/game/state/action-availability.util.ts`. The admin view now carries `canAdvance`, `canGoToPreviousQuestion` and `activeBlockStartIndex`; availability is found by trying the action through the handler's own steps (showdown walk, closest_guess sub-steps, state machine) rather than restating them. Before deleting `advance-gating.ts` I ran a throwaway comparison of old gating against the new flags at every step of a forward and backward whole-quiz walk: no differences. Two deliberate edges: with an active showdown, Advance stays allowed even while guesses are pending (the press returns a message rather than doing nothing), and Previous at showdown step 0 is now reported unavailable because the handler treats it as a no-op (the old gating showed it enabled when a previous status was recorded). `advance-gating.ts` and its tests are deleted; /control and /remote read the flags, and /control's question browser reads `activeBlockStartIndex` from the view instead of the fetched quiz list. Tests: `action-availability.spec.ts` (Advance flag vs handler at every step forward, Previous flag vs handler at every step back, closest_guess sub-steps, showdown, lobby, true start of reveal history, legacy session without a previous status). Full backend and frontend suites, lint and tsc pass. Status set to `done`.
