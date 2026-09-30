# Ticket overview

All features under `.scratch/`. A ticket is unblocked once every ticket in its "Blocked by" column is under **Done** (numbers refer to tickets in the same feature unless a feature is named). Each feature has a `spec.md` and an `issues/` folder.

## Not implemented

### gateway-handler-template ([spec](gateway-handler-template/spec.md))

| #   | Ticket                                                                                                                                          | Blocked by                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 01  | [Test that every event rejects the wrong room](gateway-handler-template/issues/01-authorization-characterization-spec.md)                       | none                       |
| 02  | [Declare each event once and route it through one dispatch step](gateway-handler-template/issues/02-event-declarations-and-guarded-dispatch.md) | 01, live-session-module 07 |
| 03  | [Delete the pass-through handlers and fix the doc comments](gateway-handler-template/issues/03-delete-pass-through-handlers.md)                 | 02                         |

### role-socket-hooks ([spec](role-socket-hooks/spec.md))

| #   | Ticket                                                                                                                                       | Blocked by |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 05  | [Control panel context replaces the 34-field sidebar props](role-socket-hooks/issues/05-control-panel-context.md)                            | 02         |
| 06  | [Display game hook; delete the three-room hook and the legacy "exception" emit](role-socket-hooks/issues/06-display-hook-and-contract.md)    | 03, 04     |


## Done

| Feature             | #   | Ticket                                                                                                                          | Commit    |
| ------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------- | --------- |
| role-socket-hooks   | 04  | [Shared admin-session connection hook; /remote moves to the admin game hook](role-socket-hooks/issues/04-admin-session-connection-remote.md) | —         |
| role-socket-hooks   | 03  | [Player game hook; /play and the join flow switch over](role-socket-hooks/issues/03-player-game-hook-play.md) | —         |
| role-socket-hooks   | 02  | [Admin game hook on a shared connection core; /control switches over](role-socket-hooks/issues/02-admin-game-hook-control.md) | —         |
| role-socket-hooks   | 01  | [Every socket event answers with an acknowledgement result](role-socket-hooks/issues/01-acknowledge-every-socket-event.md) | —         |
| standings-module    | 06  | [Stats list reads Standings](standings-module/issues/06-stats-list-reads-standings.md) | —         |
| standings-module    | 05  | [Stats detail with the participation rule, departed teams and one winner](standings-module/issues/05-stats-detail-participation-and-winner.md) | —         |
| standings-module    | 04  | [Display and phone overlay render server ranks](standings-module/issues/04-display-and-phones-render-server-ranks.md) | —         |
| standings-module    | 03  | [Teams table renders server standings; roster changes refresh them](standings-module/issues/03-teams-table-renders-server-standings.md) | —         |
| standings-module    | 02  | [Live leaderboard served by the Standings service](standings-module/issues/02-live-leaderboard-from-standings.md)              | —         |
| standings-module    | 01  | [Ranking rule prefactor](standings-module/issues/01-ranking-rule-prefactor.md)                                                  | —         |
| live-session-module | 01  | [Real-store gateway test harness](live-session-module/issues/01-real-store-gateway-harness.md)                                  | `e9af2e9` |
| live-session-module | 02  | [Outcome delivery step; timers share the Advance path](live-session-module/issues/02-outcome-delivery-and-timers.md)            | `66ddeb5` |
| live-session-module | 03  | [Answer recorded / answer graded owned by the Live session module](live-session-module/issues/03-answer-recorded-and-graded.md) | `22dad1f` |
| live-session-module | 04  | [Team removed (kick / leave)](live-session-module/issues/04-team-removed.md)                                                    | `6f17212`    |
| live-session-module | 05  | [Bonus changed and leaderboard toggle](live-session-module/issues/05-bonus-changed-and-leaderboard-toggle.md)                  | `adc82fe` |
| live-session-module | 06  | [Quiz edited (live answer-key fix)](live-session-module/issues/06-quiz-edited-regrade.md)                                      | `08a7de8` |
| live-session-module | 07  | [Remaining events through the module; delete the pass-through setters](live-session-module/issues/07-remaining-events-and-delete-setters.md) | `2b7edc4` |
| live-session-module | 08  | [Migrate game-flow specs to the real-store harness](live-session-module/issues/08-migrate-game-flow-specs.md)                   | —         |
| live-session-module | 09  | [Migrate grading, answers and team specs to the real-store harness](live-session-module/issues/09-migrate-grading-and-team-specs.md) | —         |
| live-session-module | 10  | [Contract: delete the fake-store harness](live-session-module/issues/10-contract-delete-fake-harness.md)                        | —         |
| scoring-module      | 01  | [Scoring module prefactor](scoring-module/issues/01-scoring-module-prefactor.md)                                                | —         |
| scoring-module      | 02  | [Kahoot speed from stored response time](scoring-module/issues/02-kahoot-speed-from-response-time.md)                           | —         |
| scoring-module      | 03  | [Stored verdict and verdict-based correct-count on /control and /remote](scoring-module/issues/03-stored-verdict-and-admin-correct-count.md) | —         |
| scoring-module      | 04  | [Stats read the verdict](scoring-module/issues/04-stats-read-verdict.md)                                                        | —         |
| scoring-module      | 05  | [Team phones: synced closest_guess points and the verdict](scoring-module/issues/05-team-phones-synced-points-and-verdict.md)   | —         |
| scoring-module      | 06  | [Align half points and sort comparison](scoring-module/issues/06-align-half-points-and-sort.md)                                 | —         |
| scoring-module      | 07  | [Quiz editor: kahoot type picker and toggle guard](scoring-module/issues/07-editor-kahoot-picker-and-toggle.md)                 | —         |
| screen-projection   | 01  | [Players view hides the kahoot question behind the leaderboard](screen-projection/issues/01-players-view-redacts-hidden-kahoot-question.md) | —         |
| screen-projection   | 02  | [Named on-air screen drives the big screen](screen-projection/issues/02-named-on-air-screen-drives-display.md) | —         |
| screen-projection   | 03  | [Presenter preview built from the projection](screen-projection/issues/03-presenter-preview-from-projection.md) | —         |
| screen-projection   | 04  | [Admin view: the question on display and the round indicators](screen-projection/issues/04-admin-view-on-display-question-and-indicators.md) | —         |
| screen-projection   | 05  | [Advance/Previous availability decided server-side](screen-projection/issues/05-advance-legality-server-side.md) | —         |
| screen-projection   | 06  | [Players view: answerability and the question on screen](screen-projection/issues/06-players-view-answerability-and-on-screen-question.md) | —         |
