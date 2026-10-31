# 01: Power-ups settings and the coin balance

**What to build:** a moderator can switch power-ups on, and every team sees its coins.

- `SessionSettings` gains `powerUpsEnabled`, `startingCoins` (default 2) and the per-power-up `{ cost, maxUses }` table, with the defaults from the spec (extra joker cost follows `showRoundOverview` until edited). Zod validation at the settings boundary.
- Settings form: a Power-ups section, shown as its own tab in the start dialog and in the lobby settings panel. Checkbox + number per power-up, stored as `maxUses` (0 = not offered).
- The balance is worked out (starting coins + carried coin + coin awards − purchases, no less than 0). In this ticket it's just the starting coins. It's sent in the team link and the admin view.
- Phone: coins next to the score. /control: a Coins column in the teams table.
- Rules screen: a generated power-ups line ("Power-ups are on: you start with N coins. Earn more with shots and selfies.").

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Shared-types settings, defaults and balance rule, with unit tests
- [x] Settings form tab and lobby panel, Vitest
- [x] Balance in the team link and admin view, survives reconnect
- [x] `DOCUMENTATION.md` settings section, `/guide` power-ups setup tip
