# 02: Each change says whether it touched scores

**What to build:** the decision whether a Session write re-reads standings, and flags league tables on an ended session, moves from the game state's call sites into the change modules that do the database work. Every change result has to say whether it **touched scores** (wrote answers, grades, bonus awards or the roster), and the type checker rejects one that doesn't. The game state's pass-throughs carry no score options. Quiz masters see no change: every event refreshes the leaderboard and flags league tables exactly as before.

**Blocked by:** 01 (Pin which events read standings and flag league tables)

**Status:** done

- [ ] The result every change returns to the Session write has a required touched-scores flag with no default; building a result without it fails `pnpm typecheck`
- [ ] Each change module sets it per operation, matching today's call sites. Touched scores: answer submit and grade; bonus award, edit and remove; roster join, leave and kick; the quiz-edit change (regrading and lobby reloads); Commit a move (presses and timer expiries). Didn't touch scores: round rated and feedback sent; both player counts; roster disconnect; break end time, display text size and display sound mute; showdown guess and new showdown round; settings and leagues, league top refresh, and setting leagues at session creation
- [ ] The Session write and the held write read the flag from the change result and no longer take an options argument; the standings read and the league-tables report both follow the flag. Prior standings, the deadline report and the write gate points are unchanged
- [ ] The game state's 14 "not touching scores" options and their constant are deleted, along with the Session write's options type if nothing else uses it
- [ ] Ticket 01's cases, the rest of the session-write gateway spec and the league-tables-changed spec pass with no assertion changed
- [ ] The `GLOSSARY.md` **Session write** entry says each change declares whether it touched scores, and the standings are read only when it did
