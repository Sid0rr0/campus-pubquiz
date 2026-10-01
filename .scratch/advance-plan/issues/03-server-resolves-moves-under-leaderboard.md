# 03: The server resolves Advance and Previous under the leaderboard; the admin view announces the step

**What to build:** While the leaderboard is up, a plain ADVANCE reveals the next rank and, once every rank is shown, hides the board — never moving the quiz underneath. Hide is only offered when the underlying status can advance (otherwise Advance is blocked), matching today's "Hide Leaderboard" rule. A plain PREVIOUS while the board is up is rejected and changes nothing. The admin view gains what the Advance slot does next (reveal next rank / hide leaderboard / advance / nothing) and the Previous state (available / covered by the leaderboard / unavailable), delivered on every broadcast and on reconnect. The existing availability flags stay alongside for now so today's clients keep working unchanged.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** 02 (One Move plan drives the handler, button availability and the /remote preview)

**Status:** ready-for-agent

- [ ] A raw ADVANCE under the board reveals one step (ties share a step, kahoot rounds cap at the top 5) and never changes status, round, question or reveal position underneath
- [ ] Once every rank is shown, a raw ADVANCE hides the board through the same state change as the Leaderboard toggle; if the underlying status has nowhere to go, Advance is blocked
- [ ] Hiding the between-kahoot-questions board with ADVANCE arms the same question timer as hiding it with the toggle
- [ ] A raw PREVIOUS under the board is rejected and changes nothing
- [ ] The admin view announces the Advance-slot step and the Previous state; a reconnecting admin receives them in the full-view resync
- [ ] A grade or bonus that changes the reveal step count while the board is up updates the announced Advance-slot step in the next admin view
- [ ] The agreement walk from 01 asserts the announced Advance-slot step matches what a raw ADVANCE does, and the Previous state matches what a raw PREVIOUS does, across every walk
- [ ] The presenter preview's "next" line still matches the planned step, including "Next place (n of m)" and hide-to-the-screen-underneath
- [ ] The Leaderboard toggle stays available from any status; existing clients (still sending REVEAL_NEXT_TEAM / TOGGLE_LEADERBOARD) keep working
