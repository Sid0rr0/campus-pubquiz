# 01: Test that every event rejects the wrong room

**What to build:** A table-driven gateway spec that proves every client-to-server socket event is accepted only from its one allowed room. For each of the 11 socket events it sends a well-formed payload from every room that isn't allowed, among admin, players and display. It asserts that the event is rejected with today's exact message and that nothing was emitted to any room. Companion cases lock in the rest of the rejection behaviour:
- a socket with no game session gets the "not associated with a game session" error
- an invalid payload from the wrong room gets the field-specific payload error, not the room error, because payload validation runs first today

For now the spec keeps its own list of events, sample payloads and expected messages, and drives the gateway's handler methods through the existing harness. It should pass against today's gateway with no production change. The point is to pin current behaviour before the dispatch refactor moves anything. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One spec covers all 11 socket events. Each event is sent from every disallowed room, and each case asserts the exact rejection message and that no room or socket received an emit.
- [ ] A case per event sends from a socket with no session and expects the session error.
- [ ] At least one case shows that an invalid payload from the wrong room yields the payload error, not the room error.
- [ ] The spec passes against the current gateway with no production code change.
- [ ] Assertions are only on rejections and emits, never on which internal functions were called.
