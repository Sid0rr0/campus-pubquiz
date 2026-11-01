# Repo audit log — 2026-11-01

Whole-repo audit (`/ponytail-audit`) at commit `c28952d8`. The audit itself was read-only; the fixes are in "Fixed (2026-11-01)" below. No test suites, mutation runs or one-off checks were run during the audit; every finding is traced in the code, not reproduced.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; backend reachable from the open internet (phones on mobile data).

Started from the 2026-10-28 log's "Not checked" list, plus the power-ups work that landed since (about 120 commits).

## Earlier findings (2026-10-28)

| Item | Status |
| --- | --- |
| Findings 1–8 | Fixed or retracted on 2026-10-29, see that log |
| Team-code guessing over the socket join | **Still open** (finding 2): `team.service.ts` has no failed-join counter |
| Save with no `loadedUpdatedAt` not checked | Still a `shortcut:` comment, not re-reported |
| `bonus-awards.controller.ts` imports `parseOrThrow` from `league-http` | Not rechecked |
| `trust proxy 1` on Azure | Still not checked, needs a live `req.ip` |

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Power-up rules | `shared/types/src/power-ups.ts`, `margin.ts` (widened margin) | refusal order, 50/50 draw, hints, pin, Ask the room split, balance floor | OK |
| Buying | `game/state/purchase-changes.ts`, `purchase/purchase.service.ts`, `db/entities/purchase.entity.ts`, purchases migration | seat check, limits, kahoot refusal, wider margin regrade, no unique index in the way of the follow-after-edit re-add | OK |
| Power-ups with power-ups off | `session-settings.ts`, DOCUMENTATION "Carried coins" | no `powerUpsEnabled` check in `buy` | By design: a carried coin may be spent, the shop uses the session's table |
| Extra joker | `joker-changes.ts`, `purchase-changes.ts` (`buyExtraJoker`, `followRoundsAfterEdit`), `extraJokerRoundId` | never stacks with a joker, draws skip doubled rounds, live edit follows | OK for running sessions. Ended sessions are not followed (finding 1) |
| Restart | `commit-a-move.service.ts` (placement), `live-results-read.ts`, `standings.funFactData` | purchases, coins and jokers restored | OK |
| Coin awards | `bonus/bonus.service.ts`, `bonus-awards-changes.ts` | take refused above balance, deletion covers spent coins | OK, but editing an award's sign keeps or withholds coins (finding 7) |
| Carried coins | `coins/carried-coin.service.ts`, `feedback-rounds.ts`, DOCUMENTATION | once per team, final form lists every round so an early end can still earn | OK |
| Answers | `answer/answer.service.ts` | wider margin on submit and key fix, order of regrade and purchase | OK |
| Team merge | `team/team-merge.service.ts` | new tables (coin awards, carried coins, purchases) repointed | OK |
| Standings | `standings/standings.service.ts`, `cell-points.ts`, `session-result.ts`, `ended-sessions-read.ts` (`night`) | joker and extra joker doubling; both join on the question's current round | **Past nights move when questions move** (finding 1); doubled rounds read twice (finding 5) |
| Quiz save | `quiz/quiz.service.ts` (`syncWithin`, drop and park steps), `live-edit.service.ts`, `live-edit-guard.ts` | round rows keyed by position, drop guard, frontier rules, regrade ids | Finding 1. Frontier rules OK, `describeLiveEditRounds` not read |
| CSV parser | `import/sheet-csv.parser.ts`, `question-row.schema.ts`, `shared/types/src/question-row-schema.ts`, `question-preview-schema.ts` | header aliases, row numbers, blank rows, per-type validation, match and sort repeats | OK |
| Sheet codec | `encodeSheetRow`, `apps/frontend/app/lib/quiz-csv-export.ts` | round trip; `kahootMode` not exported is documented | OK |
| Import flow | `import/import.service.ts`, `import.controller.ts`, `sheet-url-fetcher.ts`, `lib/import-api.ts`, `quizzes/[id]/quiz-draft-state.ts` (`importOutcome`) | who calls what, ids after a re-import | **Confirm routes have no caller** (finding 3); **editor re-import on a played quiz refused** (finding 4) |
| Stats calcs | `stats/session-detail.calc.ts`, `session-brief.calc.ts`, `session-feedback.calc.ts`, `player-count.calc.ts`, `stats.service.ts` (rows, trends, delete, rename) | rates, played rule, anonymity, trends | OK; max points over the whole quiz is documented; brief share not capped (finding 8) |
| League | `league/league.service.ts`, `venue-date.ts` | membership writes, tickable check, venue date | OK (double-click on add can hit the unique index, a 500 with no harm) |
| Player count | `player-count/player-count.service.ts` | upsert, reads | OK |
| Media | `media/media.controller.ts`, `media.service.ts` | server key, type sniffing | OK |
| Migrations | the last three (coin awards, carried coins, purchases) | foreign keys, cascades, indexes | OK |
| Seed on boot | `db/seed.service.ts` (`seedOpenGames`) | demo game only on an empty database | OK |
| Sentry | `apps/backend/src/instrument.ts`, `apps/frontend/instrumentation-client.ts`, `@sentry/profiling-node` build | default profile lifecycle is `manual`, no `startProfiler` anywhere | **Profiling never runs** (finding 6) |
| Dev script | `scripts/dev-admin.mjs` | local check, password | Fixed password passes a tunnel (finding 9) |
| Frontend | `play/power-ups-list.tsx`, `lib/team-link.ts`, `quizzes/[id]/quiz-draft-state.ts` (import part), `lib/import-api.ts` | purchase UI, phone state after coins and purchases | OK |
| Dependencies | `grep` of each backend and frontend dependency in source | each is imported | OK apart from finding 6 |
| Body size | `main.ts` | no `useBodyParser`, default 100 KB | Finding 10 |

## Findings

1. Editing a played quiz changes that night's scores and league tables — must fix
2. Team codes can still be guessed over the socket join (carried over) — should fix
3. `POST /import/confirm` and `/confirm-from-url` have no caller — should fix (lean)
4. Re-import on a played quiz is refused with a wrong message, and the docs say otherwise — should fix
5. Doubled rounds are read by two copies of the same queries — should fix (lean)
6. `@sentry/profiling-node` never profiles anything — should fix (lean)
7. Editing a bonus award's sign leaves its coins wrong — nice to have
8. The Night brief can print a share above 100% — nice to have
9. `dev-admin.mjs` sets a fixed, committed admin password — nice to have
10. A quiz over 100 KB of JSON can't be saved or uploaded — nice to have

## Fixed (2026-11-01)

Implemented one by one, test-first where a seam was agreed, on `main`. Reviewed with `/code-review` against `c28952d8`. Typecheck and lint clean; the full suite passed (shared 68 files, frontend 221, backend 222 suites / 3516 tests). No frontend code changed, so no browser check.

| # | Finding | Status | Commit |
| --- | --- | --- | --- |
| 1 | Editing a played quiz changes past scores | Fixed: `findMovedAnsweredQuestions` refuses (409) a save that puts an answered question in another round position, next to the dropped-question check | `86ee20a3` |
| 2 | Team codes guessable over the socket | Fixed: 10 wrong codes per team in 10 minutes (fixed window from the first miss) lock that team's code, the right one included; a missing code and a token rejoin are not counted. In memory, so a restart clears it | `5f638351` |
| 3 | Import confirm routes have no caller | Fixed: both routes, `ImportService`'s confirm path, the live-edit `strategy` / `reloadJoinCode` options, `ImportConfirmResult`, `joinCode` on the request types and their specs deleted. `ImportService` now has no dependencies. SECURITY.md corrected | `e637a577`, `268b2c74` (unused import) |
| 4 | Wrong re-import message and docs | Fixed: the refusal says a re-import replaces every question; DOCUMENTATION corrected | `667abf65` |
| 5 | Doubled rounds read twice | Fixed: `EndedSessionsRead.doubledRounds`, used by Standings and `night` | `b9acf9dc` |
| 6 | Profiler never profiles | Fixed: `@sentry/profiling-node` removed; lockfile edited by hand to drop only its entries (a plain `pnpm remove` also re-resolved ts-jest's Babel peer) | `a8991e81` |
| 7 | Bonus sign flip leaves coins wrong | Fixed: shot and selfie awards cannot change between bonus and penalty; custom awards can | `ce2215b7` |
| 8 | Brief share above 100% | Fixed: `shareOf` caps at 1 | `2a848dff` |
| 9 | Fixed dev admin password | Fixed: random per run, printed | `1396da2d` |
| 10 | 100 KB body limit | Fixed: `app.useBodyParser('json', { limit: '5mb' })`, checked on a scratch Nest app (no permanent test) | `df867f15` |

### Review notes, left open

- `wrongCodes` is never pruned for a team that stops guessing without a success (tiny: one entry per team that was ever guessed at).
- The lockout is a fixed window, so a script can still make about 10 guesses per 10 minutes per team. A longer lock after repeat windows has not been tried.
- `DROPPED_ANSWERED_MESSAGE` now mentions re-imports, which reads oddly on a plain editor delete of an answered question.
- `findMovedAnsweredQuestions` also refuses deleting an earlier unanswered round (it shifts later round positions). Stricter than the finding's wording, safe.
- The `5mb` in `main.ts` is a separate literal from `MAX_SHEET_RESPONSE_BYTES`; the two can drift.
- Style notes from the review: the `{ gameSessionId, teamId, roundId }` row shape is written three times in `doubledRounds`, and the moved and dropped guards walk the same shape.
- The 2026-10-28 open items are unchanged: no per-IP join limit, saves without `loadedUpdatedAt` are unchecked, `parseOrThrow` imported from `league-http`.

## Not checked

- Most of the frontend (~27k lines): `/control`, `/display`, the quiz editor and the stats pages were not read beyond the parts named above
- `describeLiveEditRounds` and `getSessionLiveEditFrontier` (shared frontier rules); `game-state.ts` transitions since the last audit
- Per-type CSV codecs (`QUESTION_KINDS[type].csv`), `notes-group.ts`, `ended-sessions-read.ts` beyond `night`, `team-history.service.ts`, `league-table.service.ts`
- e2e suite; migrations older than the last three; `seed()` itself
- Whether `trust proxy 1` gives the real client IP on Azure App Service (needs a live `req.ip` check)
- No mutation runs
