# 02: Declarations name their change, starting with the admin action

**What to build:** The tracer bullet. A socket event declaration can name the session change its event makes (typed against its parsed payload) and give a fallback refusal message for unexpected failures. The gateway's dispatch step runs a declared change through the session write for the event's join code, after validation, session lookup and room authorization (in that order, as today), inside the event's request context, and hands the outcome to the existing delivery step. The admin action is the first event moved: its declaration names the move pipeline's commit and today's fallback refusal message, its handler body becomes one dispatch call, and its game state method is deleted. Quiz masters see no difference. See the spec's "Declared changes" and "The dispatch step".

**Blocked by:** 01

**Status:** done

- [ ] Declarations accept an optional change and an optional fallback refusal; a change whose payload type doesn't match the declaration's schema fails typecheck
- [ ] The admin action handler body is one dispatch call with no inline function; the game state class has no admin action method
- [ ] The move pipeline spec drives the admin action through the gateway handler instead of the game state class
- [ ] New gateway spec: an unexpected failure during an admin action arrives as a refusal with its message; the same failure in an event without a fallback refusal gets the generic error
- [ ] Existing gateway and authorization specs pass without changing their expectations (refusals, display-room refusal, accepted log line)
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
