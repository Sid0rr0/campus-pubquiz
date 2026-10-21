# 01: Game state returns the full active session summary

**What to build:** a held session knows its own summary facts, and the game state hands out the complete **active session summary**. The admin session picker, the `/display` public list and the create-session response show exactly what they show today (quiz title, display name, status, team count, start time), but the sessions controller no longer stitches that together from quiz and seed lookups. The start time is always the session row's creation time, on create and on list.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The seeded game carries the quiz title, the session's custom name (null when none was set) and its start time (the session row's creation time). The game load sets them from the session row and quiz, and the hand-built boot game sets them too, so `seed()` gives the same facts whether it created or resumed the game
- [ ] Quiz-edit reloads refresh the quiz title along with the rounds, with no extra step
- [ ] A shared test-fixture default supplies the new fields, so existing seeded-game fixtures need only mechanical changes
- [ ] `listSessions` returns `ActiveSessionSummary[]` and creating a session yields the new session's summary, both built by one function that applies the shared display-name helper to the stored custom name and quiz title
- [ ] Any snapshot that other callers currently get from creating a session is still available to them
- [ ] The sessions controller's list, public list and create pass the game state's summary through; it no longer depends on the quiz service or seed service for summaries, and the `Unknown quiz` placeholder and both start-time fallbacks are gone
- [ ] The seed service's start-time and name lookups by join code are deleted (and the quiz service's title lookup, if nothing else uses it), along with their spec cases
- [ ] The session-lifecycle admin spec (real-store harness) covers: a created session's title, its name (quiz title when none was given, the trimmed custom name when one was) and its start time equal to the row's creation time; the create summary and the next list agree; status and team count follow a join and a status change; a lobby session shows a quiz rename made through the Live edit save; start time and custom name survive a restart
- [ ] The seed service spec checks that a loaded seeded game carries title, custom name and start time
- [ ] The sessions controller spec keeps only guards, request parsing (quiz id, name trimming, settings, league ids), error mapping and summary pass-through, and its quiz service and seed service stubs are deleted
- [ ] `ActiveSessionSummary` keeps its shape; no schema, protocol or frontend change
