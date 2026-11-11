# Repo audit log — 2026-11-11

Focused audit (`/ponytail-audit find all the implicit state machines`) at commit `7914a3e5`. Read-only: no code changed. No test suites or mutation runs.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; redeploys or crashes during a live night are expected (CLAUDE.md "Single backend instance").

Started from the 2026-11-03 logs' "Not checked" lists (entities were on it), then searched for state carried by nullable timestamps, boolean groups, status columns and memory-only caches.

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Entities | all `db/entities/*.ts` (status-like fields) | which columns encode a state | Inventory below |
| Session lifecycle | `game-state.service.ts` (`closeSession`), `seed.service.ts` (`seedOpenGames`, `markClosed`) | `closedAt` only set from `ended`; closed sessions not reloaded | OK |
| Showdown | `showdown.service.ts`, `showdowns-changes.ts`, `commit-a-move.service.ts` (restore, `resolveShowdownIfFinished`), `session-updates.util.ts`, `showdown-reveal.ts`, `stepped-reveal.ts`, `feedback-rounds.ts`, `team-merge.service.ts` | DB round state vs in-memory `activeShowdownRound`; restore after restart | **Open round not restored; DB guard then blocks a new one** (finding 1) |
| Answer grading | `answer.service.ts` (`upsertGradeOf`, `applyWrites`), `grading-policy.ts` | `gradedAt`/`verdict`/`pointsAwarded` always written together | OK (one `set/clear/keep` type) |
| Phase timer | `game-state-timed-phase.ts` | timer key derived, not stored separately | OK |
| Clue walk | `clue-reveal.ts`, `stepped-reveal.ts` (`withClueShown`), restore in `commit-a-move.service.ts` | memory `revealStep` rebuilt from stored `highestClueShown` | OK |
| Memory-only caches | `session-state.ts` fields vs restore | which are rebuilt on restart | Only `activeShowdownRound` is not (finding 1) |
| Users | `auth.service.ts`, `users.controller.ts`, `auth-bootstrap.service.ts`, `users/users-panel.tsx` | pending → active → deactivated transitions | **Server doesn't check the from-state** (finding 2) |
| Write queue / gate | `session-write-queue.ts`, `write-gate.ts` | hidden flags | OK (promise chain) |
| Phone team link | `lib/team-link.ts` (join, refuse, connect, disconnect, accept), `lib/use-team-link.ts` (`sendJoin`) | join-in-flight stuck, stale results | OK (results keyed by connection id; ack always resolves) |
| Frontend forms | `play/feedback-text-form.tsx`, `lib/use-game-connection.ts` (`emitOnSocket`), `play/mobile-quiz-actions-bar.tsx`, `quizzes/[id]/use-quiz-draft.ts`, `quiz-editor-panel.tsx`, `control/showdown-panel.tsx`, `teams/[id]/team-merge-panel.tsx`, `leagues/leagues-panel.tsx` | boolean groups that could reach an impossible mix | OK |

## Findings

1. An open showdown round is lost on a backend restart, and the leftover DB row blocks starting a new one — must fix
2. Approve and Deny don't check the account is still pending — nice to have

## Fixed (2026-11-11)

Implemented one by one on `main`, test first. Typecheck and lint clean; showdown specs (50) and auth specs (88) pass; `pnpm crap:changed` exit 0. Full suite and e2e not run.

| # | Status | Commit |
| --- | --- | --- |
| 1 | Fixed: `ShowdownService.loadUnresolved` rebuilds the open round (seats, guesses) when a session is placed; a resolved round is not restored. New `showdown-restore.spec.ts` restarts mid-showdown | `4a0a5cd6` |
| 2 | Fixed: `approve` and `deny` throw `UserNotPendingError` (409) unless the account is pending; the controller's three error mappings merged into `httpErrorFor`. DOCUMENTATION auth paragraph updated. Deactivating a pending account is still unchecked (UI never offers it) | `c1690c7c` |

## Not checked

- `GameProgress` overlay flags (`isLeaderboardVisible`, `isJoinOverlayVisible`, `isMediaPaused`, `previousStatus`): transitions were checked on 2026-11-03, not reread
- Roster membership (row exists = joined, kick deletes) and team presence
- `display/use-media-pause.ts` (7 refs tracking paused/muted/replay)
- Whether `sessions` rows are deleted on expiry (affects finding 2's exact failure)
- No tests or mutation runs
