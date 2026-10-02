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

**Status:** ready-for-agent

- [ ] None of the listed getters, nor `applyAction`, is on the module's public interface. Typecheck and lint pass.
- [ ] The socket event authorization spec checks that every team-owned event (submit answer, showdown guess, leave) refuses a socket that doesn't own the seat.
- [ ] The full backend suite passes.
