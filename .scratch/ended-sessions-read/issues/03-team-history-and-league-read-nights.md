# 03: Team history and league read their nights from the Ended-sessions read

**What to build:** The team page, the admin team history and the league table all get "which nights count" and "what a night is called" from the Ended-sessions read. Users see no change: the same nights, names, dates and placings as before.

The Ended-sessions read gains:

- the **ended sessions** query: a composable query of ended sessions with session id, join code, quiz id, display name, custom name, quiz title and date played, which callers narrow, join, order and page;
- the **one ended session** read: one session's header by id, or nothing if the session is unknown or hasn't ended;
- the **participations** read: for a set of teams, every ended session each took part in, with its header, newest first and session id as the tie-break;
- the **display name** rule (the custom name if set, else the quiz title), computed in SQL for sorting, plus one shared function for code that holds the two values in memory.

Team history drops its own participants union, its joins to sessions and quizzes and its own display-name expression, and reads participations instead. The single team-night view gets its header from the one-ended-session read and keeps using the Standings "has taken part" check. The league narrows the ended sessions to its own nights and drops its own status filter. The league service and session creation use the shared display-name function.

See the spec's "Interface", "Display name" and "Readers → League / Team history".

**Blocked by:**

- 01 (Ended-sessions read owns "took part")
- `.scratch/session-result-module/issues/02-session-result-module-and-team-page.md`
- `.scratch/session-result-module/issues/03-league-reads-session-result.md`

Session result tickets 02 and 03 rewrite the team history and league loading. This ticket goes after them so the two don't conflict.

**Status:** done

- [ ] Team history and the team page list the same nights, in the same order, with the same names as before.
- [ ] Opening one past night on the team page still works only for an ended session the team took part in, including after a kick.
- [ ] A league's table still includes only its ended nights.
- [ ] Team history no longer has its own participants query, and the league no longer filters by status itself.
- [ ] The display name rule exists once in SQL (in the Ended-sessions read) and once as a shared function. Team history, the league service and session creation use them.
- [ ] Adapter spec cases:
  - lobby and running sessions are absent from the ended sessions and participations reads;
  - the display name is the custom name when set, else the quiz title, both in the header and as the sort column;
  - participations are newest first, with session id breaking a tie on date;
  - the one-ended-session read returns nothing for an unknown id and for a session that hasn't ended.
- [ ] Team history and league table service spec cases that only exercised participation or the ended filter move to the adapter spec. Their happy paths and HTTP-shape cases still pass.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass.
