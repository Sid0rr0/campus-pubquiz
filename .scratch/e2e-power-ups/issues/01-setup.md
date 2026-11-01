# 01: Shared setup

**What to build:** What every power-up journey stands on: the settings a spec may seed, the fixture and the shop helpers.

Parent spec: `.scratch/e2e-power-ups/spec.md`

**Blocked by:** none

**Status:** done

- [x] `SessionSettingsInput` takes `powerUpsEnabled` and `startingCoins`.
- [x] `e2e/fixtures/power-ups.csv` imports without issues and holds the rounds the spec lists.
- [x] `e2e/support/power-ups.ts` seeds a session on that fixture, opens the phone's shop drawer, buys a power-up and reads the coins.
- [x] The helpers were run once against a real session (buy a 50/50, coins drop).

Helpers in `e2e/support/power-ups.ts`. They were run through a throwaway spec, not committed: `buyPowerUp` takes the label and records nothing yet, because a move in `MOVES` with no journey turns a full run red. Ticket 02 adds the recording. The Number's `{margin: "5%"}` isn't exercised until ticket 02.
