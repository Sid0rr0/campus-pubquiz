# 03: Delete the pass-through socket handlers

**What to build:** Each socket event's body in the gateway is the one Live session call it makes, with no handler file in between. The handlers that only unpack the event context and call one Live session method are deleted: submit answer, grade answer, kick team, leave session, rate round, send feedback, award bonus, create showdown round, submit showdown guess and join players. Their bodies move into the gateway's dispatch call for each event. Join players keeps its "is this socket still connected" check, read from the server, inline. Leave session's doc comment, which explains that an explicit log-out removes the roster row unlike a disconnect, moves onto the gateway's handler method.

The services bag type goes, along with the injected services the gateway only held to feed it (team, bonus, feedback, showdown). The guarded dispatch step and the event declarations are unchanged. Nothing changes for quiz masters or teams.

The admin-action handler is ticket 02's to remove. If this ticket lands first, leave that handler in place. Both tickets edit the gateway, so whichever lands second rebases.

Parent spec: `.scratch/outcome-deadlines/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [ ] No handler file is left that only forwards to one Live session method.
- [ ] The gateway's constructor injects only what it uses.
- [ ] The socket event authorization spec and every per-event gateway spec pass. Specs that build the gateway drop the removed services from their setup, and nothing else in them changes.
- [ ] `CODING_STANDARDS.md` and `docs/architecture.md` no longer describe a handler file per event, if they do today.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend suite pass.
