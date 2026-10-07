# 01: The Screen projection lives in shared types

**What to build:** The Screen projection and every pure rule it reads move into shared types, and the backend uses them from there. Every room is sent exactly what it is sent today. After this ticket, any workspace can run the real projection on a session state, which tickets 02 to 05 rely on.

What moves, unchanged in logic:
- the projection itself (one entry taking session state and a room and returning that room's view, typed per room) and the reveal-walk trimming
- the core snapshot builder, the block-question readers, kahoot visibility, the admin view flags, the feedback field, the showdown view, the closest_guess and showdown reveal step rules, and the question view conversions
- the Move plan, with its Advance and Previous descriptions and the showdown "guesses pending" error
- the session state type, with the seeded game, seeded round and roster entry shapes, the game context reader and the fresh-session factory

The backend keeps everything stateful (the Session write, Commit a move, the Settle step, the write queue, timers, grading, standings, database reads) and imports the moved rules. Host notes stay a sibling of the questions, so the conversions still can't spread them into a view.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** socket-protocol 01 (split socket-events by concept) and socket-protocol 04 (single-room fields in their room view).

**Status:** done

- [x] The diff reads as moves plus import changes. Any logic change is called out in the commit body, and ideally there is none.
- [x] The backend projection specs pass unchanged: screen projection, players view, admin flags projection, core snapshot, block questions, session snapshot leak and screen projection delivery. So do the Move plan, Commit a move and Settle step specs, and the shared types game-state tests.
- [x] No backend module keeps a second copy of a moved rule.
- [x] `DOCUMENTATION.md`'s room-view paragraph names the shared projection in place of the backend file.
- [x] `docs/architecture.md` diagrams that place the Screen projection or the Move plan in the backend show them in shared types.
- [x] The **Move plan** and **Settle step** entries in `GLOSSARY.md` are checked so they don't say "the backend's".
- [x] `pnpm typecheck`, `pnpm lint` and the backend and shared-types suites pass.
