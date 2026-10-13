# 01: The server keeps the prior standings, and a reconnecting big screen counts up from them

**What to build:** A big screen that reloads or reconnects mid-kahoot counts the between-questions leaderboard up from the real standings before the last question, not from 0. The session keeps the prior standings, worked out by the display's capture rule moved to the server unchanged, and the display view carries them. The display stops remembering boards itself and uses the sent prior standings wherever it used its memory. A big screen that stayed connected sees exactly what it sees today.

Parent spec: `.scratch/leaderboard-before-board/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Write first, and watch fail against today's code: a backend real-store spec where a big screen joins or resyncs between kahoot questions and receives the standings from before the last question's points landed.
- [ ] The Session write updates the prior standings. When a write starts from a session whose question is on air (open or locking) and whose leaderboard is hidden, that session's current leaderboard becomes the prior standings before the new standings are read. Otherwise they carry over. Before any board exists they are every team on 0.
- [ ] The prior standings are ephemeral like the reveal counters (not saved); a restored session after a backend restart has none.
- [ ] The display view carries the prior standings; the socket event schema is updated.
- [ ] The display page drops its remembered-board state and the capture call, and passes the sent prior standings as the between-questions count-up board and as the kahoot round-end/quiz-end trend baseline, exactly where it used its memory before.
- [ ] The display-side capture rule and its test are deleted; the capture cases (capture only while on air with the board hidden, grading or a bonus while on air included, first kahoot question from 0) become backend real-store assertions on the view.
- [ ] Existing display, leaderboard component and kahoot leaderboard specs pass unchanged.
- [ ] GLOSSARY.md defines prior standings.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend and frontend tests pass.
