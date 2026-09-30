# 01: Players view hides the kahoot question behind the leaderboard

**What to build:** A team's phone never receives a kahoot question while it is hidden behind the between-questions leaderboard. Today the one shared snapshot carries its prompt and options to every room, both as the current question and inside the block questions, and only a filter in the phone's socket hook keeps it off screen. This ticket introduces the Screen projection with its three audiences (display, admin, players). The state broadcast and the connect/reconnect resync each send the room its own view. In the players view the hidden question is removed on the server. The display and admin views are the current snapshot unchanged. See the spec's Implementation Decisions ([spec](../spec.md)).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] One named rule decides "question hidden behind the kahoot leaderboard". The answer-submission gate uses it instead of its own copy, and the existing kahoot leaderboard answer-gate tests still pass.
- [x] The Screen projection module takes the session record and an audience, and returns that audience's view. It is pure and uses the existing snapshot fields as its shared base.
- [x] The state broadcast emits STATE_UPDATED once per room, each with that room's view. Presenter context is still emitted first.
- [x] STATE_SYNC on connect/reconnect sends the connecting role's view.
- [x] While a kahoot question is hidden behind the leaderboard, the players view leaves it out of both the current question and the block questions. The display and admin views keep it.
- [x] Shared types have a base payload plus one view type per room (display, admin, players). The phone's socket hook is typed per role.
- [x] The kahoot-hidden special case in the socket hook's seen-questions merge is deleted. The merge takes the players view as it arrives.
- [x] Projection tests walk a kahoot round and assert on each audience's serialized view that the hidden prompt is absent for players and present for display and admin.
- [x] Gateway tests connect display, admin and players sockets. They assert that the players socket's STATE_UPDATED and STATE_SYNC payloads lack the hidden prompt, that the display and admin payloads contain it, and that a reconnecting socket gets its own role's view.
- [x] When the leaderboard is dismissed, the question appears on phones as it does today, and the existing /play tests still pass.

## Comments

Implemented in the commit adding `screen-projection.util.ts` and `kahoot-visibility.util.ts` (`apps/backend/src/game/state/`), with per-room delivery in `game-broadcast.util.ts` and `connection.util.ts`. The shared rule covers the open phases (question open, locking, round intro), which is exactly where the answer gate could previously return true, so the gate's behaviour is unchanged. The players view clears `currentQuestion` and `blockQuestions` while that rule holds. The display and admin views are the snapshot unchanged. Tests: `screen-projection.spec.ts` (serialized views across a kahoot round), `screen-projection-delivery.spec.ts` (STATE_UPDATED and STATE_SYNC per socket role), a rewritten hook test, and a /play test for the redacted and dismissed states. Full backend (106 suites), frontend (101 files) and shared-types suites, lint and tsc pass. Status set to `done`.
