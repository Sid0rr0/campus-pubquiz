# 02: Creating or restoring a session survives a failed results read

**What to build:** Creating a session, and restoring one after a backend restart, no longer fail because a standings read failed. Today placing a session reads the live results with no fallback: one failed read fails `POST /sessions`, and stops a restart from restoring the session. After this ticket, placement ends with the same live results read the session write uses. A failed read is logged and that figure keeps the empty value a fresh session starts with. A new session starts with an empty leaderboard, which is what it would have read anyway. A restored session shows empty figures until its next event (an answer, grade, bonus or press) catches them up. When nothing fails, the leaderboard, tallies and fun facts are right straight after a restart, as today.

The league top is explicitly not a live result: a league table counts only ended sessions, so this session's scoring can't change it, and reading it costs a full league table. Placement asks the league change module for it by name after the live results read. The league change module keeps its read-or-null behaviour and sets the league top on the session directly. Score writes never read it.

The four one-line helpers for the leaderboard, verdict tallies, fun fact data and league top are deleted. The prior-standings helper and the session record's other per-field helpers stay.

See the spec's "Callers → Placement / League change module" and "Docs, in the same change".

**Blocked by:** 01 (Session writes end with one live results read)

**Status:** done

- [ ] Placement (creation and restart) ends with the live results read, then gets the league top from the league change module. Its own four-way read and field spreads are gone.
- [ ] The four one-line live result and league top helpers are deleted.
- [ ] New gateway cases on the real-store harness:
  - with the leaderboard read forced to fail, creating a session succeeds, the board is empty, and the first answer graded afterwards appears on it;
  - with a standings read forced to fail during restore, the session is restored at its saved position, and the next write brings back the leaderboard, verdict tallies and fun fact data;
  - with the league top read spied on, an answer, a grade and a bonus don't read it, while creation and restart do.
- [ ] The commit-a-move spec's "standings cannot be read" case and the league top spec's restart and refresh cases still pass. Any updates match the new policy.
- [ ] GLOSSARY.md adds **Live results**: the leaderboard, verdict tallies and fun fact data a live session holds, re-read after every write that touches scores and when the session is placed. It also says the league top is not one of them, and why.
- [ ] DOCUMENTATION.md:
  - the session write paragraph says the final read covers every live result, and a failed read keeps that figure's earlier value;
  - the persistence and restart section says placement uses the same read and fallback;
  - the verdict tallies paragraph points at **Live results**;
  - the league top paragraph says it is read at placement and on league changes only, never on score writes.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass. `pnpm e2e` has been run once before the PR.
