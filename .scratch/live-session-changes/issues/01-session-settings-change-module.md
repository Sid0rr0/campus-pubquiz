# 01: Session settings change module

**What to build:** The quiz master's session-value events behave exactly as today, but the session settings change module builds them instead of the game state class:

- setting or clearing the break end time,
- setting the display text size,
- changing settings in the lobby.

This ticket sets the pattern the other domain tickets copy:

- **The module is a plain class composed inside the game state class**, like the Move committer. It takes only the services its domain uses (the seed service, for persisting lobby settings) and has no reference to the Session write module or the game state class.
- **Each event is a change builder.** It takes the session as the previous write left it, plus the event's input, and either throws its refusal or returns the new session with its outcome.
- **Each façade event method is one write call.** It hands the builder's change to the Session write module's `write` and passes the "doesn't touch scores" option at that call. All three events here skip the standings read, as they do today.
- **The lobby-only check stays exactly as it is**, still raising the settings-update-blocked error with the same message, and still running against the session the previous write left.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** None within this spec. The session-write-module spec (tickets 01 and 02) must be done first.

**Status:** ready-for-agent

- [ ] The break end time, display text size and lobby settings events are built by the session settings change module. Their façade methods are each a single `write` call carrying the "doesn't touch scores" option.
- [ ] The session settings change module imports neither the Session write module nor the game state class.
- [ ] The game state class's public interface is unchanged.
- [ ] Every existing backend spec passes without edits, in particular:
  - set-break-end-time, set-display-text-scale, update-session-settings, session-creation-defaults,
  - the session-write spec's lobby-settings and "events that do not touch scores" cases.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
