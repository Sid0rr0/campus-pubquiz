# 03: Team link returns a join part and a joined-game part

**What to build:** The Team link hook's 25 loose fields become two parts, so each consumer takes only what it uses. It stays one hook with one socket and the same state machine, because two hooks would open two connections.

- **Join part:** team name, team, has stored identity, active join code, connection error, the name, game code and team code inputs with their setters, join, log out, and needs join form
- **Joined game part:** present once a view has arrived and absent before. It holds the players view (never absent inside it), my answers, grades, bonus awards, round ratings, feedback, the round ratings epoch, seen questions, and submit answer, submit showdown guess, rate round and send feedback.

Teams see no difference: every screen, toast, rating, answer and reconnect behaves as today.

See the parent spec: `.scratch/phone-question-browser/spec.md`.

**Blocked by:** 01 (Phone question browser hook), 02 (Join gate defined once in the Team link)

**Status:** ready-for-agent

- [ ] The hook returns the join part and the joined game part; its commands, pending answer, confirmation timer, storage, toasts and reconnect paths are unchanged
- [ ] /play uses the join part for the join form, "Connecting…" and the header identity; it uses the joined game for everything after and passes its view to the phone question browser; its defaults for missing answers, grades, ratings and feedback are removed
- [ ] The home page's join panel uses the join part plus whether a joined game exists; the player menu bridge takes only the team name, team and log out
- [ ] The /play Team link fake mirrors the two parts: `join` keeps its lazy localStorage reads, the joined game is built from the described session or absent without one, and tests override `join` or `game` fields only
- [ ] All /play test files and the home page test switch to the new fake with unchanged assertions; the Team link hook tests change only how they read the result
- [ ] New hook test (test-first): the joined game is absent before the first view and present after it, carrying the team's data from the join payload
- [ ] GLOSSARY: add an **Auto-advance** entry if none exists; extend **Team link** only if the two parts need names
- [ ] Frontend suite, `pnpm typecheck` and `pnpm lint` pass
