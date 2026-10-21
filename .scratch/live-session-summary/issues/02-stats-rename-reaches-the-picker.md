# 02: A stats rename of an ended session reaches the session picker

**What to build:** a moderator who renames an ended session on the stats page, or clears its name, sees the change in the session picker straight away while the session is still held (listed until it is closed). A session that has already been closed renames exactly as today.

**Blocked by:** 01 (Game state returns the full active session summary)

**Status:** ready-for-agent

- [ ] After updating the row, the stats rename updates the held session's custom name when that session is still held, through the Session write, as an ordinary write that doesn't touch scores and broadcasts nothing new
- [ ] Renaming a session that isn't held (closed, or evicted) still succeeds, with no in-memory update
- [ ] The rename rules are unchanged: ended sessions only, and a blank name clears the custom name
- [ ] A real-store case checks that after a rename the list shows the new name for a held ended session, that after clearing it the list shows the quiz title, and that renaming a closed session succeeds
- [ ] The stats service spec's existing rename cases pass unchanged
