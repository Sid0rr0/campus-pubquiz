# 08: The getters go

**What to build:** This is the contract step. Every handler now goes through an event method, so the Live session module stops exposing the reads that handlers used to apply rules themselves:

- the connected-socket getter
- question-open-for-answering
- phase start
- active showdown round
- showdown reveal step
- session settings

`applyAction` is deleted, and its one test drives `applyAdminAction` instead. The getters that REST controllers, connection setup and timer re-arming still need stay. If "seat" has stuck as a term, add it to `CONTEXT.md`.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 02, 03, 04, 05, 06, 07.

**Status:** done

- [x] None of the listed getters, nor `applyAction`, is on the module's public interface. Typecheck and lint pass.
- [x] The socket event authorization spec checks that every team-owned event (submit answer, showdown guess, leave) refuses a socket that doesn't own the seat.
- [x] The full backend suite passes.

## Comments

Removed `isQuestionOpenForAnswering`, `getPhaseStartedAt`, `getActiveShowdownRound`, `getShowdownRevealStep`, `getSessionSettings` and `applyAction` from `GameStateService`; the connected-socket getter had already gone with tickets 04/05. `awardBonus` reads the session's settings directly. Specs that read settings now use `getSnapshot(...).settings`; the `applyAction` test drives `applyAdminAction`; the players-view agreement test now submits an answer through the gateway instead of calling the gate. `socket-event-authorization.spec.ts` gained a check that submit answer, leave and showdown guess each refuse a socket that doesn't own the seat. `getTeamIdForSocket` stays (rate round and send feedback handlers use it).

"Seat" was not added to `CONTEXT.md`: it already means a showdown's turn order there, so using it for socket ownership would clash. Full backend suite, typecheck and lint pass.
