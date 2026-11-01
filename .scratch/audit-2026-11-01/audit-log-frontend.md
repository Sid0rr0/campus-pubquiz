# Frontend audit log — 2026-11-01

Frontend audit (`/ponytail-audit frontend`) at commit `53a1834c`, run after the whole-repo audit in `audit-log.md`. Read-only: no code changed. No test suites, mutation runs or browser checks were run; every finding is traced in the code, not reproduced.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; phones on mobile data that lock and wake often.

Started from `audit-log.md`'s "Not checked" list, which named most of the frontend.

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Team link | `lib/team-link.ts`, `use-team-link.ts`, `team-storage.ts`, `join-gate.ts`, backend `team.service.ts` (`join`) | join, retries, resend of a pending answer, leave rules, stored token | **Token beats a typed name** (finding 5). Retries, resend and leave rules OK |
| Socket core | `lib/use-game-connection.ts`, `use-reconnect-on-wake.ts`, `use-admin-game.ts`, `use-display-game.ts`, backend `connection.util.ts`, `game.gateway.ts` (refused joins) | reconnect, refusal, stale state | **Refusal text** (8), **wake reaches only phones** (7), **socket revived after disable** (9). Sessions restore before `listen`, so a redeploy does not refuse sockets: OK |
| Session restart | `shared/types/src/game-state.ts`, `lib/seen-questions.ts` | seen questions after a move into the lobby | OK: only Previous from `rules` enters the lobby, so no question was seen |
| /play | `play/page.tsx`, `question-browser.tsx`, `use-phone-question-browser.ts`, `phone-question-selection.ts`, `answer-form.tsx`, `answer-inputs.tsx`, `sort-answer.tsx`, `match-answer.tsx`, `saved-confirmation.tsx`, `opened-questions.ts`, `power-ups-list.tsx`, `game-status-screens.tsx`, `joker-round.ts`, `joker-pick-screen.tsx`, `feedback-text-form.tsx`, `reveal-verdict-card.tsx`, `leaderboard-screen.tsx`, `my-standing.ts`, `player-count-card.tsx`, `showdown-guess-form.tsx`, `components/join-form.tsx`, `join-panel.tsx`, backend `grading-policy.ts` | drafts, IDK, Kahoot lock, power-up buttons, joker rules | **Draft lost on reconnect** (1), **showdown guess** (4), **IDK in the box** (10), **blank answer after IDK** (11). Joker, verdict and feedback draft OK |
| /control and /remote | `control/page.tsx`, `answers-panel.tsx`, `custom-grade-control.tsx`, `use-admin-keyboard-shortcuts.ts`, `bonus-award-form.tsx`, `bonus-awards-list-modal.tsx`, `break-end-time-control.tsx`, `teams-panel.tsx`, `teams-table.tsx`, `session-status-panel.tsx`, `remote/page.tsx`, `lib/use-admin-session.ts`, `use-auth.tsx`, `live-change.ts` | shortcuts, grading, bonus form, redirects | **Key repeat** (3), **bounce to /sessions** (6), **menu closes** (15). Live answers focus and bonus form OK |
| /display | `display/page.tsx`, `question-display.tsx`, `use-media-pause.ts`, `video-file.tsx`, `question-lock-countdown.tsx`, `display-session-picker.tsx`, `components/leaderboard.tsx`, `leaderboard-rows.ts`, `lib/use-seconds-left.ts`, `use-lock-countdown-sound.ts`, `display-sounds.ts`, `final-placing.ts`, `display-code-storage.ts` | totals, ties, media, sound timing | **Half points rounded** (2), **early sound** (19), duplicate tick (18). Refused and reconnecting told apart correctly |
| Quiz editor | `quizzes/[id]/use-quiz-draft.ts`, `quiz-draft-state.ts`, `quiz-editor-panel.tsx`, `use-quiz-import.ts`, `media-url-field.tsx`, `answer-kind-drafts.ts`, `grading-setting-drafts.ts`, `page.tsx`, `lib/quiz-csv-export.ts`, `quiz-draft-api.ts`, `media-api.ts` | save, stale check, display order, unsaved state | **Reshuffle after a save** (13), **no unsaved warning** (14) |
| Staff pages | `sessions/session-picker-panel.tsx`, `components/running-sessions-list.tsx`, `session-settings-form.tsx`, `stats/played-sessions-panel.tsx`, `stats/[id]/scoresheet-table.tsx`, `teams/[id]/team-merge-panel.tsx`, `users/users-panel.tsx`, `lib/stats-api.ts`, backend `auth.service.ts` (`deactivate`) | destructive actions, table state | **Deactivate** (16). Merge confirm OK |
| Team page | `team/team-page-panel.tsx`, backend `team-history.service.ts` | answers shown to the team | **Raw stored answers** (12) |
| Config | `next.config.ts`, `vercel.json`, Sentry files, `instrumentation*.ts`, `package.json`, `providers.tsx` | dependencies, dead config, XSS sinks | Every dependency is imported; no `dangerouslySetInnerHTML`. `sentry.edge.config.ts` has no edge route to run on (left out as smaller) |

## Findings

1. A phone that locks loses the half-typed answer — must fix
2. The big screen rounds half points to a wrong total — must fix
3. Holding an arrow key on /control skips many screens — must fix
4. A failed showdown guess looks accepted — must fix
5. A typed team name is ignored when an old token is stored — should fix
6. /control and /remote jump to /sessions on a short network failure — should fix
7. /remote and /control do not reconnect when a device wakes — should fix
8. A wrong game code shows "Disconnected: io server disconnect" — should fix
9. Waking a phone revives a socket that was shut — should fix
10. "I don't know" shows as `__idk__` in the text box — should fix
11. Tapping "I don't know" twice leaves a blank answer to grade — should fix
12. My Team page shows raw stored answers — should fix
13. A second save reshuffles sort and match questions — should fix
14. The quiz editor gives no warning before losing unsaved work — should fix
15. The team actions menu on /control closes by itself — should fix
16. Deactivate has no confirm step and no way back — should fix
17. 13 API error classes do the same job — should fix (lean)
18. Sort and match answers, and the lock countdowns, repeat each other — should fix (lean)
19. The countdown sound ends early when the lock is over 60 seconds — nice to have

Left out as smaller: `sentry.edge.config.ts` and its branch in `instrumentation.ts` have no edge route to run on; the named-key branch of `matchesKey` in `use-admin-keyboard-shortcuts.ts` is dead by its own comment.

## Fixed (2026-11-02)

Implemented one by one on `main`, test first, one commit each (`daf5ac01` to `3edbef69`). Reviewed with `/code-review` against `53a1834c`. Typecheck and lint clean; the full suite passed (shared 68 files, frontend 224 files / 2543 tests, backend 222 suites / 3517 tests). Changed screens were seen in the browser (see the report); nothing was submitted on `/play`.

| # | Status | Commit |
| --- | --- | --- |
| 1 | Fixed: the answer form stays mounted and is hidden while unlinked | `daf5ac01` |
| 2 | Fixed: count-up uses `nearestHalfPoint`; a half-point bonus shows as a number | `bfca6e0f` |
| 3 | Fixed: `event.repeat` ignored in the shortcut hook | `22209d06` |
| 4 | Fixed: the guess form waits for the server's answer | `6ae50824` |
| 5 | Fixed: token dropped for a different name; accepted name shown and stored | `5587a8b0` |
| 6 | Fixed: redirect only on `refused` (`connectionIssue` now on `useAdminGame`) | `28db1e13` |
| 7 | Fixed: wake reconnect moved into `useGameConnection`, so `/display` reconnects on wake too | `e057c87c` |
| 8 | Fixed: the server's refusal text is shown | `f36f9943` |
| 9 | Fixed: socket ref cleared on cleanup | `afe9c9bf` |
| 10 | Fixed: the text box starts empty | `17e51018` |
| 11 | Fixed: a blank free-text answer is graded 0 at submit (backend) | `47c91198` |
| 12 | **Retracted, no change**: `EndedSessionsRead.night()` already words answers with `formatAnswer` | – |
| 13 | Fixed: the stored display order is kept after a save | `418f12be` |
| 14 | Fixed: `beforeunload` guard while the editor has unsaved edits (in-app navigation is not guarded) | `d322a4f4` |
| 15 | Fixed: stable column definitions; coins moved into the row data | `c80e6b40` |
| 16 | Fixed: confirm for Deactivate and Deny | `aeb02f82` |
| 17 | Partly fixed: one `ApiError`, `readErrorBody` and `errorMessageOf`; the five unguarded clients now tolerate a non-JSON body. `media-api.ts` and four local `throwApiError` wrappers remain | `1e66e16f` |
| 18 | Fixed: `useReorderableDraft`; both countdowns use `useSecondsLeft` | `814ac6e0` |
| 19 | Fixed: the track waits until 60 s remain | `86654fe0` |

Docs: `DOCUMENTATION.md` updated in `294dc644`.

### Review notes, left open

- ~~`handleSubmit` has no `try/finally`~~ Fixed: `showdown-guess-form.tsx` resets `isSending` in a `finally` (`df7051a8`).
- The delayed countdown track starts outside a user gesture and relies on the earlier unlock; a browser that revokes autoplay could drop it silently.
- `readErrorBody` is exported partly for `import-api.ts`; ~~the `throwApiError` wrappers in `auth`, `stats`, `leagues` and `teams` could become one shared function~~ Fixed: `apiErrorThrower` in `api-error.ts` (`df7051a8`). `quiz-draft-api.ts` keeps its own (it also reads a body field).
- The hidden state of the answer form was checked in a unit test, not in a browser.

## Second pass (2026-11-02)

Continued from the "Not checked" list below, at commit `42c9a89c`, with the same assumed load. No code changed. Finding 20 was reproduced with a throwaway Vitest spec (since deleted); the rest are traced in the code. No full test suites were run and nothing was done in the app in a browser.

### Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| /control panels | `showdown-panel.tsx`, `question-browser-panel.tsx`, `question-detail.tsx`, `mobile-admin-bar.tsx`, `desktop-sidebar.tsx`, `session-settings-panel.tsx`, `team-code-dialog.tsx` | edit state, rejected saves, live vs stored data | **Settings wiped** (20), **duplicate panels** (24). Showdown rejection toasts through `emitAction`: OK |
| Quiz editor | `quiz-question-editor.tsx`, `quiz-round-editor.tsx`, `answer-kind-fields.tsx`, `quiz-outline.tsx`, `quiz-import-controls.tsx`, `quiz-draft-state.ts`, `use-quiz-import.ts`, `quiz-editor-panel.tsx` | live pins, kahoot rules, hidden clip fields, drag guards | **Stale save errors** (21), **no confirm** (22). Pins and clip narrowing OK |
| Preview | `preview/quiz-preview-panel.tsx`, `providers.tsx` | stale step index | OK: no refetch on focus, and a changed order remounts the stepper |
| /display | `answer-kind-bodies.tsx`, `display-screen-view.tsx`, smaller screens, `use-display-screen-sounds.ts` | reveal shapes, IDK and blank answers, marquee, sounds | OK |
| Stats and teams | `stats/feedback/`, `stats/[id]/`, `teams/`, backend `session-detail.calc.ts`, `fun-facts.ts` | number and answer wording | OK: answers are worded before they reach the page; points columns are whole or half |
| League | `league/league-panel.tsx`, `leagues/leagues-panel.tsx`, `league-table.calc.ts` | form state, rounding | **Form not cleared** (25). Average placing arrives rounded: OK |
| Public and auth pages | `rules/page.tsx`, `how-to-play/page.tsx`, `guide/guide-content.tsx`, `login/`, `register/`, `site-header.tsx`, `mobile-header-menu.tsx` | network drops, guide vs screens | **Rules lose the game** (23), **guide wording** (26) |

### Findings

20. Lobby settings edits are wiped when a team joins or drops — must fix (reproduced)
21. Save errors land on the wrong question after a delete or move — should fix
22. One click removes a round or replaces the whole draft, with no confirm — should fix
23. `/rules?code=` falls back to the generic rules on a short network drop, and stays there — should fix
24. Desktop sidebar and mobile drawer repeat the same controls and props — should fix (lean)
25. The New league form keeps its text after Create — nice to have
26. The guide says Session Settings sets the quiz — nice to have
27. Small dead code: `rounds.length > 0` in `question-browser-panel.tsx`, `useMemo(() => sessions)` in `team-sessions-table.tsx`, unused `export type { MoveTargetRound }` in `quiz-round-editor.tsx`, wrong "no move-between-rounds" comment in `quiz-outline.tsx` — nice to have

Dropped after checking: the Points box's `Number(value) || 0` (question points must be whole, so a half-typed decimal costs nothing).

## Not checked

- Test quality; e2e suite; CSS and accessibility
- The big-screen layouts themselves: nothing was looked at on a real screen
- The first pass's browser gap: finding 15's remount and the timing in findings 1 and 7 are read from the code and the table library's source, though `/code-review` browser checks covered changed screens afterwards
- Still open from `audit-log.md`: `describeLiveEditRounds`, per-type CSV codecs, `team-history.service.ts` beyond the night read, `league-table.service.ts`, `trust proxy 1` on Azure
