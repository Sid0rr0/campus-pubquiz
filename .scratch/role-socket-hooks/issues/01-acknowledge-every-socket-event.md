# 01: Every socket event answers with an acknowledgement result

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** Every client-to-server socket event (admin action, join players, submit answer, grade answer, kick team, leave session, set break end time, set display text scale, award bonus, create showdown round, submit showdown guess) now replies to the sender with a typed acknowledgement result:

- success, with an optional event-specific payload; or
- failure, with the same client-safe message the client sees today.

Unexpected errors are logged server-side with full context and return a generic message.

This ticket only adds the reply. During the transition the gateway still emits the legacy untagged "exception" to the sender on rejection, so today's frontend keeps working unchanged. Ticket 06 removes that.

The handler method returns the result, and Nest sends a returned value as the Socket.IO acknowledgement. The code that turns a rejection into a failure result is plain code the handler methods call, not a Nest exception filter or interceptor, because gateway tests call handler methods directly. If the gateway handler template spec has already landed, put this conversion in its guarded dispatch step.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Shared types export one acknowledgement result type (success with optional data, or failure with a message), following the project's response-envelope convention
- [ ] Every client-to-server gateway event returns that result on success and on every rejection (payload validation, wrong room, domain rejections such as an illegal transition, ungraded answers, a bonus cap or a locked question)
- [ ] An unexpected error is logged with context and returned with a generic message
- [ ] The legacy "exception" emit to the sender still happens on rejection, so the current frontend behaves exactly as before
- [ ] Handshake-time rejections (unknown session code, invalid or expired admin session) are unchanged
- [ ] Gateway tests, calling handler methods directly as today, assert for each event: success on the happy path; failure with the client-safe message for validation, wrong-room and one representative domain rejection; the generic message for an unexpected error
- [ ] Existing specs that expected a thrown WebSocket exception now expect a failure result with the same message, and keep their "nothing was emitted" assertions
