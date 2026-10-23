# 03: shared/types: remaining mutation survivors

Status: ready-for-agent

Blocked by: None

From the 2026-10-24 full run of `pnpm --filter @campus-pubquiz/types mutate` (33 survived, 4 no coverage). All paths are under `shared/types/src/`. None of these files had a first-audit ticket.

**Fun facts (`fun-facts.ts`, 16):** the break-screen facts. Survivors show the selection filters aren't pinned:

- `:279`, `:341`, `:405`, `:408`: whole `.filter(...)` calls can be dropped (leaderboard holders, revealed jokers, revealed questions and answers). Test with unrevealed questions or jokers present, which must not feed a fact.
- `:335`, `:374`: `every` → `some` survives (all of a round's questions past; beats every other round).
- `:375`, `:418`, `:430`: boundary `>` → `>=` survives (zero correct rate, zero teams, equal joker points).
- `:425`: `Math.abs(correctRate - HALF)` → `correctRate + HALF` survives, so "closest to 50/50" isn't tested with rates either side of half.
- `:164`, `:226`, `:388`, `:126` (no coverage, `kahootMode ?? false`): cover each.

**Notes group (`notes-group.ts`, 7):** the CSV notes parser at the import boundary.

- `:28`: `[ \t]*` → `[ \t]` survives. Test `YouTube clip:{…}` with no space and with two spaces.
- `:41`: the margin cell regex survives losing `+` on decimals and the `$` anchor. Test `2.25`, and `5%x` must be refused.
- `:45`: dropping `.trim()` survives. `:62`: dropping the case-insensitive flag survives. `:82` and `:100`: cover the missing-scoring and missing-seconds branches.

**YouTube timecodes (`youtube.ts`, 3):** `:14` (trim), `:16` (too many `:` parts) and `:17` (the `^` anchor, so `x12` must be refused).

**Round note (`round-note.ts`, 4):** `:14` (the `round_title` / `break_round_title` screen check), `:69` and `:77` (missing round, first non-null note), and `:87` (no coverage: `showNoteOnScreen` off returns `''`).

**Leave as accepted (CODING_STANDARDS "Tests" exempts constants and error classes):** `game-state-types.ts:141-149`, `showdown-guesses-pending-error.ts:4-5`, `answers.ts:22`. Disable each with a reason, so the report reads clean.

**Decide on the spot:** `question-csv-codec.ts:44`. `options: ''` → `"Stryker was here!"` survives for a type that has no options. Assert the encoded row's `options` is empty.

Done when a one-file run on each file named here shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
