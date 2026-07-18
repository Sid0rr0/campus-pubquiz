# TDD Evidence Report: Milestone 3 — Google Sheets Import + Media Rounds

## Source plan

`.claude/plans/milestone-3.plan.md` — 7 phases (shared contract, CSV parsing +
validation, ImportService, REST endpoints, admin import panel, media
rendering, verification). One mid-flight scope change: the user redirected
the import mechanism from "paste a Google Sheets share URL" (server-side
fetch + SSRF allowlist) to "upload an exported CSV file" (client reads the
file, POSTs the text). This removed the `sheet-url.util.ts` file and the
SSRF risk from the plan's risk table entirely — there is no server-side
fetch of user-supplied URLs in the shipped implementation.

## User journeys

1. As a quiz master, I want to upload a CSV export of my quiz sheet, so that
   I can see a validated preview (rounds, questions, per-row issues) before
   anything is saved.
2. As a quiz master, I want re-uploading an edited CSV to update the same
   quiz in place, so that I can keep refining questions right up to quiz
   night without creating duplicate quizzes.
3. As a quiz master, I want the import blocked while a quiz is in progress
   or the sheet has validation issues, so that a bad upload can't corrupt a
   running game or silently drop broken questions.
4. As a team on a phone, I want to be told to look at the big screen for
   picture and audio questions, so that I know the answer isn't going to
   appear on my device.
5. As the big screen, I want picture and audio questions rendered with the
   right media element (image vs. autoplaying audio player), so that both
   media round types actually work, not just plain image URLs.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 1 | `SheetRow`, `ImportRowIssue`, `ImportPreview`, `ImportRequest`/`ImportConfirmResult` DTOs + `createImportPreview` importability rule in `shared/types` | `cd shared/types && pnpm test` | PASS (30/30, includes 5 new) |
| 1b | Contract pivot: `ImportRequest.sheetUrl` → `csvText` per user's upload-instead-of-paste decision | direct `tsc` on the test file (RED), `pnpm test` + `pnpm build` (GREEN) | PASS |
| 2 | `sheet-csv.parser.ts` (BOM/header-tolerant CSV → `SheetRow[]`, sheet-true row numbers) + `question-row.schema.ts` (Zod discriminated union per `QuestionType`) | `cd apps/backend && pnpm test -- --testPathPatterns import` | PASS (21/21) |
| 3 | `ImportService.preview`/`confirm` — pure preview, idempotent upsert on `(quizId/roundId, orderIndex)` unique indexes, lobby/ended-only locking, active-quiz reload, answer stripped from player-facing `QuestionView` | Testcontainers Postgres via `pnpm test -- --testPathPatterns import.service` | PASS (11/11) |
| 4 | `POST /import/preview`, `POST /import/confirm` behind `AdminPasswordGuard` (mirrors the socket handshake check); 422 with issues on blocked import, 409 on locked import | `pnpm test -- --testPathPatterns 'admin-password\|import.controller'`, `pnpm test:e2e` | PASS (13/13, e2e 1/1) |
| 5 | `import-api.ts` REST client + `ImportPanel` (upload → preview table with issues → confirm gated on `isImportable`), wired into `AdminPage`'s lobby/ended quiz picker | `cd apps/frontend && pnpm test` | PASS (98/98, includes 10 new) |
| 6 | Display renders `picture` as `<img>` / `audio` as `<audio controls autoPlay>`; PlayPage shows "Look at the screen" hint for both media types; hardcoded fixture gained an audio question | `cd apps/frontend && pnpm test` | PASS (98/98, includes 4 new) |
| 7 | Full workspace verification (this report) | see below | PASS |

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | An import preview is importable only when there are questions and zero issues | `shared/types/src/import.test.ts` | unit | PASS |
| 2 | CSV parsing tolerates BOM, header casing/spacing/aliases, quoted fields with embedded commas/newlines, and missing optional columns | `apps/backend/src/import/sheet-csv.parser.spec.ts` | unit | PASS |
| 3 | Row numbers stay 1-based-counting-the-header even when blank rows are skipped | `apps/backend/src/import/sheet-csv.parser.spec.ts` | unit | PASS |
| 4 | A missing required CSV column throws `SheetFormatError` naming the column | `apps/backend/src/import/sheet-csv.parser.spec.ts` | unit | PASS |
| 5 | Multiple-choice rows require ≥2 pipe-separated options and an answer that is one of them | `apps/backend/src/import/question-row.schema.spec.ts` | unit | PASS |
| 6 | Picture/audio rows require a valid http(s) `media_url`; free-text does not | `apps/backend/src/import/question-row.schema.spec.ts` | unit | PASS |
| 7 | Points must be a positive whole number; empty points defaults to 1 | `apps/backend/src/import/question-row.schema.spec.ts` | unit | PASS |
| 8 | Rows group into rounds by first appearance; every round grades after itself | `apps/backend/src/import/question-row.schema.spec.ts` | unit | PASS |
| 9 | `preview()` never writes to the database, even for a malformed file | `apps/backend/src/import/import.service.spec.ts` | integration (Testcontainers) | PASS |
| 10 | `confirm()` is idempotent: re-importing the same CSV keeps quiz/question ids stable | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 11 | Re-importing an edited CSV updates in place and deletes rounds/questions removed from the sheet | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 12 | `confirm()` rejects a sheet with validation issues without writing anything (`ImportBlockedError`) | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 13 | `confirm()` rejects importing while a quiz is running (`ImportLockedError`), allows it in lobby/ended | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 14 | Importing the currently active quiz reloads `GameStateService`'s in-memory rounds | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 15 | The stored answer never leaks into a player-facing `QuestionView` after import | `apps/backend/src/import/import.service.spec.ts` | integration | PASS |
| 16 | `AdminPasswordGuard` allows only an exact, non-empty `x-admin-password` match against `ADMIN_PASSWORD` | `apps/backend/src/import/admin-password.guard.spec.ts` | unit | PASS |
| 17 | `ImportController` is decorated with `AdminPasswordGuard`; 400 on missing/empty `csvText` | `apps/backend/src/import/import.controller.spec.ts` | unit | PASS |
| 18 | Blocked imports surface as HTTP 422 with `issues` attached; locked imports as 409 | `apps/backend/src/import/import.controller.spec.ts` | unit | PASS |
| 19 | The REST client attaches the admin password header and JSON body to preview/confirm calls | `apps/frontend/app/lib/import-api.test.ts` | unit | PASS |
| 20 | A non-ok response raises `ImportApiError` carrying `message` and any `issues` | `apps/frontend/app/lib/import-api.test.ts` | unit | PASS |
| 21 | Uploading a CSV previews parsed rounds/questions; issues are listed with row/field | `apps/frontend/app/admin/import-panel.test.tsx` | unit (RTL) | PASS |
| 22 | Confirm is disabled until the preview is importable; clicking it calls `confirmImport` and notifies the parent | `apps/frontend/app/admin/import-panel.test.tsx` | unit (RTL) | PASS |
| 23 | Preview/confirm errors are shown as an alert without crashing the panel | `apps/frontend/app/admin/import-panel.test.tsx` | unit (RTL) | PASS |
| 24 | Display renders a `picture` question's `mediaUrl` as an `<img>`, never an `<audio>` | `apps/frontend/app/display/page.test.tsx` | unit (RTL) | PASS |
| 25 | Display renders an `audio` question's `mediaUrl` as an autoplaying `<audio controls>`, never an `<img>` | `apps/frontend/app/display/page.test.tsx` | unit (RTL) | PASS |
| 26 | PlayPage shows "Look at the screen" for picture/audio questions, not for free-text | `apps/frontend/app/play/page.test.tsx` | unit (RTL) | PASS |

## Coverage and known gaps

Full-workspace validation run at the end of Phase 7:

```text
pnpm test    → shared/types 30/30, backend 156/156, frontend 98/98 (284 total)
pnpm lint    → 0 errors (2 pre-existing warnings, unrelated to this milestone:
                apps/backend/src/main.ts floating-promise on bootstrap();
                apps/frontend/coverage/block-navigation.js generated artifact)
pnpm build   → shared/types tsc, nest build, next build all clean
```

Coverage by workspace (threshold: 80% lines/branches/functions/statements):

| Workspace | Stmts | Branch | Funcs | Lines | Command |
|---|---|---|---|---|---|
| shared/types | 100% | 100% | 100% | 100% | `pnpm test:coverage` |
| apps/backend | 91.34% | 84.42% | 91.22% | 91.49% | `pnpm test:cov` |
| apps/frontend | 98.52% | 93.79% | 92.45% | 98.52% | `pnpm test:coverage` |

`apps/backend/test:e2e` — 1/1 pass (unchanged hello-endpoint smoke test; no
new e2e spec was added since the plan's REST validation was already covered
by the mocked-service controller unit tests in Phase 4, per the plan's own
validation step for that phase).

Known gaps (intentional, not regressions):
- `app.module.ts`, `db.module.ts`, `main.ts` show 0% coverage — these are
  NestJS composition-root/bootstrap files exercised only by the running
  process, consistent with their coverage before this milestone.
- `game.gateway.ts` branch coverage (82.27%) reflects pre-existing gateway
  code paths (malformed payload branches) not touched by this milestone.

## Merge evidence

Checkpoint commits on `main`, in order (RED → GREEN per phase, one refactor
commit for the URL→upload pivot):

1. `4cbc342` test(shared-types): reproducer for sheet import contract (RED)
2. `c8ceb1f` feat(shared-types): sheet import contract + importability rule (GREEN)
3. `821d33a` refactor(shared-types): CSV upload instead of sheet URL (pivot, RED→GREEN)
4. `38f0a76` feat(backend): csv sheet parsing + per-type zod row validation (GREEN)
5. `75c9b88` test(backend): reproducer for import preview/idempotent save (RED)
6. `21f036c` feat(backend): idempotent csv quiz import with lobby-only locking (GREEN)
7. `10d5c46` feat(backend): REST import endpoints behind admin password guard (RED→GREEN)
8. `d0aabcc` test(frontend): reproducer for import REST client + admin panel (RED)
9. `66dcdba` feat(frontend): admin csv import panel wired into lobby quiz picker (GREEN)
10. `5f3c80e` test(frontend): reproducer for per-type media rendering + play hint (RED)
11. `3c075e4` feat(frontend): per-type media rendering + screen-look hint (GREEN)

All commits are reachable from `HEAD` on `main` at the time of this report.
