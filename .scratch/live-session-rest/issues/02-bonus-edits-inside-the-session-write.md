# 02: Bonus edits and deletions inside the Session write

**What to build:** When a quiz master edits or deletes a **bonus award** from the bonus drawer, the change runs as one **Session write**, the same way awarding one already does. No other write to the session can land between the database change and the leaderboard refresh. The leaderboard on `/control`, `/display` and `/remote` shows the edit straight away, as today.

The game state service gets `editBonus(joinCode, awardId, points, reason)` and `removeBonus(joinCode, awardId)`, each one Session write alongside `awardBonus`. The bonus awards change module grows `edit` and `remove` changes next to `award`. Each calls the bonus service inside the write, with the session's own game session id. An invalid award (zero points, or a custom award with no reason) becomes a session refusal with the bonus service's message. A not-found award becomes its own refusal type, so that the REST entry maps it to a 404 as today. Every bonus change refreshes standings.

The REST entry's edit and remove methods call these, then hand the outcome to delivery. The game state service's `bonusChanged` and the change module's `changed` are deleted, since nothing calls them any more.

To prepare for ticket 03, the bonus service's `remove` returns the removed award's team id (or the change reads the award first, inside the write).

See the spec's "Bonus edits and deletions inside the Session write".

**Blocked by:** 01 (REST entry to the Live session module)

**Status:** ready-for-agent

- [ ] Through the real-store harness: an edited award shows its new points in the next snapshot to all three rooms
- [ ] Through the real-store harness: a deleted award drops out of the leaderboard in the next snapshot
- [ ] An edit queued behind a held write (the harness's hold-the-next-write helper) is applied after that write, and the snapshot that follows reflects both
- [ ] A refused edit (zero points, custom with no reason, an award from another session) stores nothing and emits nothing; REST still answers 400 / 404 with today's messages
- [ ] `bonus-changed.spec`'s REST cases call the REST entry instead of the bonus service plus a hand-paired delivery
- [ ] `bonusChanged` and the change module's `changed` are gone
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass
