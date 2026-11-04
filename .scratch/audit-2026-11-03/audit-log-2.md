# Repo audit log — 2026-11-03 (second pass)

Whole-repo audit (`/ponytail-audit`, "audit what hasn't been checked yet") at commit `dacc2c5d`. Read-only: no code changed. Ran the e2e suite and the incremental mutation run; one finding was reproduced with a node script against the built `shared/types` dist.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; backend reachable from the open internet (phones on mobile data).

Started from the "Not checked" lists of this morning's `audit-log.md` and `audit-log-frontend.md`, plus a list of backend files no earlier log names.

## Earlier findings (2026-11-03, first pass)

All five repo findings and both frontend findings are fixed; see the "Fixed (2026-11-03)" sections added to `audit-log.md` and `audit-log-frontend.md`. The fix commits were read: `clientIpOf`, the `teams_code_unique` migration (it renames repeats before adding the constraint) and the retry in `unusedTeamCode` are correct.

## Checked

| Area | Files read / run | What was checked | Result |
| --- | --- | --- | --- |
| e2e suite | `pnpm e2e` (prod builds, `campus_pubquiz_e2e`) | every journey | **30/30 passed** in 1.9 min |
| Mutation | `pnpm mutate` (incremental: shared/types, backend DB-free slice, frontend) | test strength | shared 98.47% (42 survived), backend 92.99% / 99.00% covered (13 survived, 84 no coverage), frontend 97.22% (66 survived). Survivors read for power-ups, client-ip, live-edit-guard: message strings and equivalent mutants, no finding |
| State machine | `game-state.ts`, `game-state-forward-transitions.ts`, `game-state-backward-transitions.ts`, `game-state-block-position.ts`, `game-state-structure.ts` | every Advance/Previous, block bounds, kahoot rounds, joker pick needing the overview | Transitions OK. Kahoot Previous to `locking` is closed by `revealedKahootQuestionIds` (checked commits `cf79b268`, `9a5543bd`). **Break count counts a kahoot round** (finding 2), reproduced |
| Break numbers | `display-screen.ts`, `screen-preview.util.ts`, `quiz.service.ts` (`list`), `components/rules-content.tsx`, `lib/bonus-categories.ts` | where the structure summary is shown | Finding 2 reaches the big screen, /control, quiz list and rules screen |
| Grading | `game/state/block-grading.service.ts` | reveal gate order, kahoot speed scoring, closest-guess batch, key-fix regrade, ungraded cache | OK. Speed scoring also runs on Previous out of `locking`; harmless, rescored on the next lock |
| Session outcome / delivery | `session-outcome.ts`, `game/socket/session-broadcaster.ts` | reveal entry, league refresh never fails delivery, deactivate drops sockets | OK |
| REST into live sessions | `game/rest/live-session-rest.service.ts` | unknown-session mapping, parse after the live check | OK |
| Lobby settings | `game/state/session-settings-changes.ts` | lobby-only, jokers-need-overview on a partial patch, extra joker default cost | OK |
| Admin bootstrap | `auth/auth-bootstrap.service.ts` and its spec, `auth.service.ts` (`register`, `approve`) | first admin creation | **Promote keeps the registrant's password** (finding 1) |
| Team history | `team/team-history.calc.ts` | wins, podiums, share cap, empty lists | OK |
| Migrations (all 40) | `rg` for drops, deletes, updates; read every data-rewriting `up()` | destructive steps, backfills | Every drop is in `down()`; backfills (verdict, retypes, scoring mode rename, half stars) OK |
| Unique keys | `.snapshot.json` against every `upsert` | conflict target exists | OK for answers, jokers, feedback, ratings, carried coins |

## Findings

1. A self-registered account named like the bootstrap admin becomes admin with its own password — must fix
2. A kahoot round with "Break after" ticked is counted as a break, so the big screen says "BREAK 3" at the second break — should fix

## Fixed (2026-11-04)

Implemented one by one on `main`, test first. Typecheck and lint clean; the full suite passed (shared 69 files / 1788 tests, frontend 226 / 2614, backend 223 suites / 3537). No `apps/frontend/app` file changed, so no browser check. Reviewed with `/code-review` against `dacc2c5d`.

| # | Status | Commit |
| --- | --- | --- |
| 1 | Fixed: the promote branch sets the env password; the spec checks the env password matches and the registrant's no longer does. A pending account can't log in and holds no session, so nothing to revoke | `7e17874f` |
| 2 | Fixed for a kahoot round before the last: it ends no block, so it gets no break number; `quiz.service.ts` now passes `kahootMode` (own backend spec) | `9eeeab43`, `9b8b8e4e` (comment) |

### Review notes, left open

- **Spec review:** a quiz *ending* on kahoot rounds still counts a break after them ("Break N (final)" on that round's /control card; "a break after each round" on the rules screen), and topics are still counted from the last break round, not a round count. Kept on purpose: the last break also means "nothing left to play" (`isShowingLastBreak` crowns the winners and hides the bonus list), so dropping that block would crown the winners while kahoot rounds remain. Splitting "last break" from "nothing left to play" would fix both; not done.
- **Standards review:** the round → `GameContext` mapping is written three times (`getGameContext`, `toGameContext`, the inline one in `QuizService.list`); the third had dropped `kahootMode`. One shared mapper would stop the next field going missing. Not done.
- Commit `9eeeab43` is scoped `shared-types` but also touches the backend's quiz list (the root cause is in shared types).

## Not checked

- CSS, big-screen layouts on a real screen, screen-reader output of the drag lists
- `pnpm --filter backend mutate:db` (the DB-backed slice); the 84 no-coverage backend mutants were not listed
- The real `req.ip` on Azure: no longer blocks anything, since the port is dropped either way
- Frontend beyond what the earlier frontend logs cover
- Smaller unread backend files: `quiz-draft.schema.ts`, `session-updates.util.ts`, `quiz-edit-change.ts`, entities, `league/leagues.controller.ts`, `stats/stats.controller.ts`
