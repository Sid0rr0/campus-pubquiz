# Spec: E2E coverage of power-ups and coins

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-11-01 ("add e2e tests for the power ups").

## Problem Statement

[Power-ups](../power-ups/spec.md) shipped with Vitest and real-Postgres Jest specs, and no browser journey ever sets `powerUpsEnabled`. The shop on the phone, the effects on the answer forms, the coin awards from `/control` and the counts on `/display` have never run together, so a full `pnpm e2e` would still pass with the shop gone.

## Solution

One spec file, `e2e/tests/power-ups.spec.ts`, with seven journeys over one new CSV. Every term is defined in `GLOSSARY.md` (Power-ups section). Harness decisions (ports, database, production builds, `retries: 0`) are unchanged from the [`e2e-tests`](../e2e-tests/spec.md) and [`e2e-journeys-2`](../e2e-journeys-2/spec.md) specs.

## Implementation Decisions

- **Boundary.** Every power-up is bought on a real phone; the journey checks the coins drop and the effect shows. A score is asserted only where the effect shows nowhere else (wider margin, the extra joker). Rules (rounding, purchase eligibility, pin selection), server refusals, kahoot rounds and showdowns stay with the shared-types and Jest specs.
- **Random draws.** 50/50 and pin one are asserted by shape only: the right option survives and half are left; one item is pinned and its handle disabled. Never in an ARIA snapshot, which would fail on most runs.
- **Seeding.** Sessions are seeded through the API by `SessionSettingsInput` (`powerUpsEnabled`, `startingCoins`). Only journey 7 goes through the lobby's Power-ups tab.
- **Fixture.** `e2e/fixtures/power-ups.csv`. Round 1 (`Helps`, its own block) holds a four-option multiple choice, a free text, a sort, a match and a Number with key 200 and `{margin: "5%"}`. Round 2 (`Doubles`, its own block) holds one free text.
- **Coverage registry.** `MOVES` gains `power_up_<id>` for each of the seven power-ups and `coin_award`, recorded by the helpers. Each journey ticket adds the moves it covers, so the suite is green at every commit and `E2E_COVERAGE=off` isn't needed. The list is written by hand: the e2e workspace doesn't depend on the shared types and this doesn't justify adding them.
- **Snapshots.** Four variants through `snap`: the phone's `rules` with power-ups on, the phone's open shop drawer on `question_open`, `/control`'s `question_open` with the Coins column and an answer's power-up labels, and `/display`'s `reveal` with the counts.
- **Carried coins.** The one exception to "one session per test": the journey needs a first night to rate and a second to spend in. Its helper creates a league and both sessions through the API, and opens a second `ControlScreen`.
- **Reconnect.** A phone reload only. A backend restart adds runtime and little risk, because purchases are read from one stored ledger.
- **Product bugs.** A bug a journey finds gets its own ticket and `fix(...)` commit; no test is bent around it.

## Testing Decisions

- Assert what the people in the room see, never socket payloads or database rows.
- Each journey passes `--repeat-each=5` before its ticket is done, run one command at a time.
- A journey that outgrows the 90-second test timeout gets split, not a longer timeout.
- A full `E2E_SKIP_BUILD=1 pnpm e2e` stays under five minutes with the default workers.

## Out of Scope

- The desktop `PowerUpsPanel`: it renders the same list as the drawer.
- Buying during `locking`.
- Deleting a bonus award that brought coins (Jest covers the cascade).
- Stacking refusals on the extra joker.
- A backend restart with purchases.
