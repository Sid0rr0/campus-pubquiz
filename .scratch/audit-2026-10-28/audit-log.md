# Repo audit log — 2026-10-28

Whole-repo audit (`/ponytail-audit`) at commit `55e62c21`. Read-only: no code changed. No test suites run; two one-off checks were run (a node script against the built `shared/types` dist, and a `real`-column sum in the local docker Postgres).

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; backend reachable from the open internet (phones on mobile data).

Started from the 2026-10-26 log's "Not checked" list.

## Earlier findings (2026-10-26)

| # | Finding | Status |
| --- | --- | --- |
| 1 | Kahoot Previous reopens answers | Fixed (`cf79b268`, `9a5543bd`) |
| 2 | Auto-lock timer double-steps | Fixed (`463f64ba`, `27decb7c`) |
| 3 | Socket events unthrottled | **Still open** (no throttle under `apps/backend/src/game/`) |
| 4 | `createSessionSnapshot` test-only | Fixed (`0cf2ce65`) |
| 5 | `AppService` wrapper | Fixed (`5f122ca0`) |

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Scoring | `shared/types/src/scoring.ts`, `score-math.ts`, `answer-kind.ts` (formats), `margin.ts` | per-type scoring, rounding, verdicts, closest guess, speed multiplier | **Match per_item verdict wrong at rounding edges** (finding 1), reproduced with built dist |
| Question validation | `question-payload-schema.ts`, `question-preview-schema.ts` | numeric keys, min items, points are positive ints | OK |
| Phone number input | `apps/frontend/app/play/answer-inputs.tsx` | decimal comma | `type="number"` normalises, OK |
| Points storage | `answer.entity.ts`, `bonus-award.entity.ts`, migrations, `socket-payload.schemas.ts`, `control/custom-grade-control.tsx`, `components/leaderboard.tsx` | float columns vs. displayed totals | **`real` sums print `10.30000001…`** (finding 2), reproduced in Postgres |
| Standings | `standings/standings.service.ts` (queries), `cell-points.ts`, `session-result.ts` | joker doubling, bonus fan-out, correct counts | OK apart from finding 1/2 effects |
| League | `league/league-table.calc.ts` | league points, ties, ordering | OK |
| Quiz save | `quiz/quiz.controller.ts`, `quiz/quiz.service.ts` (update/sync), `game/live-edit/live-edit.service.ts`, `quiz/live-edit-guard.ts` (dropped-answered) | transaction, hold, guard, client ids | **No stale-save check** (finding 3); **client question ids not scoped to the quiz** (finding 6) |
| Showdown | `game/state/showdowns-changes.ts`, `showdown/showdown.service.ts`, `commit-a-move.service.ts` (resolve) | seat checks, resolve idempotency, award write | **Resolved flag written before the award, no transaction** (finding 4) |
| Bonus | `bonus/bonus.service.ts`, `bonus/bonus-awards.controller.ts` | checks, cap, REST body | PATCH body cast not parsed (finding 7) |
| Joker | `joker/joker.service.ts` | upsert, clear drawn | OK |
| Feedback | `feedback/feedback.service.ts`, `team-feedback-changes.ts` (round check), payload schemas | round belongs to session, star range | OK |
| Payload decoding | `db/question-payload.ts` | bad stored payload | Logged and thrown, OK |
| Deploy | `render.yaml`, `.github/workflows/deploy.yml`, DOCUMENTATION "Deploy and CI", `main.ts` | real host | Azure; `render.yaml` dead (finding 8) |

## Findings

1. Match per_item gives "partial" for full points and for zero points — must fix
2. Decimal hand grades and bonuses print float noise on the big screen — must fix
3. A stale quiz editor tab silently overwrites a newer save — should fix
4. Showdown winner can end up with no points — should fix
5. Socket events still unthrottled (carried over) — should fix
6. Quiz save trusts question ids from the client — should fix
7. Two staff REST bodies are cast, not parsed — nice to have
8. `render.yaml` is dead config — nice to have (lean)

## Fixed (2026-10-29)

Implemented one by one, test-first, on `main`. Reviewed with `/code-review` against `ccd46f89`. Typecheck clean; the full suite passed (shared 65 files, frontend 213, backend 215 suites) and backend lint is clean. The last follow-up commit was checked with the touched specs only, not the whole suite.

| # | Finding | Status | Commit |
| --- | --- | --- | --- |
| 1 | Match per_item verdict | **Retracted, no change.** The 0-point "partial" is deliberate (pinned by a test; GLOSSARY.md: the verdict follows pairs right, not points). The full-points-but-partial edge (1 pt, 5 pairs, 4 right) follows from the same rule and was left as is | – |
| 2 | Float noise in points | Fixed: grade, bonus and showdown points must be whole or half points (`multipleOf(0.5)`); custom-grade input `step={0.5}` | `41341867` |
| 3 | Stale editor tab overwrites a newer save | Fixed: `QuizDraft.updatedAt` / `loadedUpdatedAt`, refused with **412** (not 409, so the 409-only "Refresh lock state" button stays hidden). `syncRoundsAndQuestions` now stamps `updatedAt`, so a CSV re-import moves it too | `1912ebd9` |
| 4 | Showdown winner left with no points | Fixed: `resolve` runs in one transaction. Test harness now uses `fork({ useContext: true })`, since a plain fork ignores transactions | `d608c7be` |
| 5 | Socket events unthrottled | Partly fixed: 60 events per 10 s per connection. **Per-IP join limit not done** (client IP behind the Azure proxy is not trusted, and a shared address would lock a venue out) | `bb7f187d` |
| 6 | Foreign question ids on save | Fixed on update (`LiveEditService.save`) and, after review, on `POST /quizzes` (a new quiz holds no questions, so any id is foreign) | `a867bdf9`, `5dd400a6` |
| 7 | Unchecked REST bodies | Fixed: quiz save body envelope (422), bonus edit body (400, same half-point rule as the socket) | `758bd8d2` |
| 8 | `render.yaml` dead config | Fixed: deleted; env var list moved to DOCUMENTATION.md; references in SECURITY.md and `app.controller.ts` updated | `c974110e` |

Also: `d2ad8ac0` types the rate-limit test matcher (lint); `5dd400a6` tightens the rate-limit specs (imports the limits, isolation test asserts success).

### Still open

- Team-code guessing over the socket join: only the per-connection limit applies, so a script can open more sockets. A per-join-code failed-join counter would avoid the proxy-IP problem and has not been tried.
- A save with no `loadedUpdatedAt` (re-import, API client) is not checked, and with no session on the quiz the check and the write are not locked together (noted in a `shortcut:` comment and DOCUMENTATION.md).
- `bonus-awards.controller.ts` imports `parseOrThrow` from `@/league/league-http`; a shared HTTP util would be cleaner.
- Not seen in a browser: the custom-grade input on `/control` and the quiz editor's save (both behind a login with no credentials); covered by tests only.

## Not checked

- Most of the frontend (~27k lines): only the phone answer input, custom grade input, leaderboard rendering and editor save hook were looked at
- `stats/*.calc.ts` in detail (session detail, brief, feedback, player count)
- CSV parser (`import/sheet-csv*.ts`, `parseQuestionRow`) in detail; `findLiveEditViolations` frontier rules
- `league.service.ts` (membership writes), `player-count.service.ts`
- Migrations beyond column types; `seed.service.ts`; Sentry setup; e2e suite
- Whether `trust proxy 1` gives the real client IP on Azure App Service (needs a live `req.ip` check)
- No test suites or mutation runs
