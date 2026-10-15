# 02: The quiz master sees and corrects player counts on `/control`

**What to build:** The `/control` Teams panel shows each team's **player count**, or "—" when the team hasn't given one. A team whose count is above the session's "max players per team" setting gets an over-cap flag. No penalty is applied: the quiz master can still give the house-rules penalty as a bonus award. The quiz master or a moderator can set or correct any team's count from the panel at any point in the session, and the new count appears on that team's phones.

The admin view's team roster entries gain `playerCount` (`number | null`) and `isOverPlayerCap` (boolean). The server works out the flag from the session's own max players per team setting, so changing that setting in the lobby changes the flag and `/control` doesn't repeat the rule. The edit is a new admin-room event, `SET_TEAM_PLAYER_COUNT` `{ teamId, playerCount }`, gated like `KICK_TEAM` and allowed for admins and moderators. It uses the same Zod validation as the phone's event (a whole number, 1–20) and is refused for a team that has never been on this session's roster. It writes the same per-team, per-session count as the phone (last write wins) and reaches the team's phones through the per-team sync. The big screen is unchanged.

Parent spec: `.scratch/player-count-and-team-stats/spec.md`

**Blocked by:** 01 (Teams report their player count)

**Status:** done

- [ ] Gateway harness: when a team sets its count, the admin view's roster entry shows it; `null` before any count is set
- [ ] Gateway harness: `isOverPlayerCap` is true above the session's max players per team and false at or below it
- [ ] Gateway harness: the admin sets a team's count and gets an ok ack; the team's phones receive the new count and the admin view shows it
- [ ] Gateway harness: `SET_TEAM_PLAYER_COUNT` from a non-admin socket is refused, an out-of-range or non-whole count is refused, and a team never on the roster is refused
- [ ] `/control`: the Teams panel shows the count and "—" and the over-cap flag, and the edit control sends the event with the chosen count
- [ ] `/guide` explains the count, the over-cap flag and how to correct it; `DOCUMENTATION.md` documents the admin event and the admin view fields
