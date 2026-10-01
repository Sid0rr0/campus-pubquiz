# Ticket overview

All features under `.scratch/`. A ticket is unblocked once every ticket in its "Blocked by" column is under **Done** (numbers refer to tickets in the same feature unless a feature is named). Each feature has a `spec.md` and an `issues/` folder.

## Not implemented

### players-reveal-redaction ([spec](players-reveal-redaction/spec.md))

| #   | Ticket                                                                                                                                                                 | Blocked by |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 02  | [Phones draw the phone screen the server names](players-reveal-redaction/issues/02-phones-draw-the-phone-screen-the-server-names.md)                                   | 01         |
| 03  | [A closest-guess reveal reaches phones one step at a time](players-reveal-redaction/issues/03-closest-guess-reveal-reaches-phones-step-by-step.md)                     | 01         |
| 04  | [The final block's answers survive a reconnect after the quiz ends](players-reveal-redaction/issues/04-final-block-answers-survive-a-reconnect-after-the-quiz-ends.md) | 01         |

## Done

| Feature                     | #   | Ticket                                                                                                                                                                 | Commit    |
| --------------------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| players-reveal-redaction    | 01  | [The players view carries only the reveal walk so far](players-reveal-redaction/issues/01-players-view-carries-only-the-reveal-walk-so-far.md)                         | —         |
| commit-a-move               | 06  | [The presenter preview is a dry-run commit](commit-a-move/issues/06-preview-is-dry-run-commit.md)                                                                      | —         |
| commit-a-move               | 05  | [One Commit-a-move module carries out every press](commit-a-move/issues/05-commit-a-move-module.md)                                                                    | —         |
| commit-a-move               | 03  | [The Move plan plans every action, lobby start included](commit-a-move/issues/03-move-plan-plans-every-action.md)                                                      | —         |
| commit-a-move               | 04  | [/remote says Advance is waiting for grading](commit-a-move/issues/04-remote-says-waiting-for-grading.md)                                                              | —         |
| commit-a-move               | 02  | [The Settle step knows the step kind](commit-a-move/issues/02-settle-step-knows-step-kind.md)                                                                          | —         |
| commit-a-move               | 01  | [Agreement walk pins today's preview against the real press](commit-a-move/issues/01-agreement-walk-pins-preview.md)                                                   | —         |
| grading-refresh             | 03  | [The grading stages, break entry and restore end through the grading refresh](grading-refresh/issues/03-grading-stages-break-restore-through-refresh.md)               | —         |
| grading-refresh             | 02  | [Answer submitted or graded ends through the grading refresh](grading-refresh/issues/02-answer-changes-through-refresh.md)                                             | —         |
| grading-refresh             | 01  | [A live answer-key fix refreshes /control's ungraded markers](grading-refresh/issues/01-key-fix-refreshes-ungraded.md)                                                 | —         |
| round-title-card            | 01  | [One round title card component for round_intro, break_round_intro and reveal_intro](round-title-card/issues/01-shared-round-title-card.md)                            | —         |
| rename-grading-status-group | 01  | [Rename the `grading` status group to name the break, not the act of grading](rename-grading-status-group/issues/01-rename-grading-group-to-break.md)                  | —         |
| typed-answer-grading        | 01  | [A typed answer that matches the key grades itself; anything else waits for the moderator](typed-answer-grading/issues/01-match-auto-grades-otherwise-moderator.md)    | —         |
| ungraded-source             | 04  | [The grading stages end through one standings step](ungraded-source/issues/04-grading-stages-share-standings-step.md)                                                  | —         |
| ungraded-source             | 03  | [A restored session knows its ungraded questions straight away](ungraded-source/issues/03-restore-refreshes-ungraded.md)                                               | —         |
| ungraded-source             | 02  | [One reader answers "which questions are ungraded" for the gate, the refresh and the per-answer update](ungraded-source/issues/02-one-ungraded-reader.md)              | —         |
| ungraded-source             | 01  | [Agreement walk pins the admin view's ungraded set against the database](ungraded-source/issues/01-agreement-walk.md)                                                  | —         |
| phone-question-selection    | 02  | [Snap back and re-pin move into the selection module](phone-question-selection/issues/02-snap-back-and-re-pin.md)                                                      | —         |
| phone-question-selection    | 01  | [A pure module picks the phone's question and its neighbours](phone-question-selection/issues/01-selection-precedence-and-neighbours.md)                               | —         |
| display-screen-kind         | 01  | [/display renders by the On-air screen's kind](display-screen-kind/issues/01-display-switches-on-screen-kind.md)                                                       | —         |
| moderator-guide             | 01  | [Rewrite `/guide` around the moderator's tasks, fed from the app's own sources](moderator-guide/issues/01-task-based-guide-from-shared-sources.md)                     | —         |
| question-kind-module        | 07  | [Audio and YouTube questions can carry multiple-choice options](question-kind-module/issues/07-audio-youtube-optional-choices.md)                                      | —         |
| question-kind-module        | 06  | [Editor and answer/display select by entry](question-kind-module/issues/06-editor-and-answer-display-read-entry.md)                                                    | —         |
| question-kind-module        | 05  | [Scoring lists derive from entries, and closest_guess literals go](question-kind-module/issues/05-scoring-lists-from-entries.md)                                       | —         |
| question-kind-module        | 04  | [CSV encode and decode live in the entries, with a round-trip test](question-kind-module/issues/04-csv-in-entries-with-round-trip.md)                                  | —         |
| question-kind-module        | 03  | [Persistence parses stored payloads instead of casting](question-kind-module/issues/03-payload-codec-replaces-casts.md)                                                | —         |
| question-kind-module        | 02  | [Import and draft save share one schema](question-kind-module/issues/02-shared-schema-for-import-and-draft.md)                                                         | —         |
| question-kind-module        | 01  | [Registry skeleton with parity and characterization table](question-kind-module/issues/01-question-kind-registry-and-parity-table.md)                                  | —         |
| session-settle              | 04  | [Advance and Previous settle through the same step](session-settle/issues/04-advance-previous-settle.md)                                                               | —         |
| session-settle              | 03  | [Creation and restore go through the settle step](session-settle/issues/03-settle-step-for-create-and-restore.md)                                                      | —         |
| session-settle              | 02  | [Restart and creation pin the derived session fields](session-settle/issues/02-restart-and-creation-characterization.md)                                               | —         |
| session-settle              | 01  | [Named status groups replace the inline status lists](session-settle/issues/01-named-status-groups.md)                                                                 | —         |
| advance-plan                | 03  | [The server resolves Advance and Previous under the leaderboard; the admin view announces the step](advance-plan/issues/03-server-resolves-moves-under-leaderboard.md) | `ce63df0` |
| advance-plan                | 05  | [Contract: delete the old Advance contract](advance-plan/issues/05-contract-delete-old-advance-contract.md)                                                            | —         |
| advance-plan                | 04  | [/control and /remote render the announced step and send only ADVANCE/PREVIOUS](advance-plan/issues/04-clients-render-announced-step.md)                               | —         |
| advance-plan                | 02  | [One Move plan drives the handler, button availability and the /remote preview](advance-plan/issues/02-move-plan-drives-handler-availability-preview.md)               | —         |
| advance-plan                | 01  | [Agreement walk pins today's Advance and Previous](advance-plan/issues/01-agreement-walk-characterization.md)                                                          | —         |
| gateway-handler-template    | 03  | [Delete the pass-through handlers and fix the doc comments](gateway-handler-template/issues/03-delete-pass-through-handlers.md)                                        | —         |
| gateway-handler-template    | 02  | [Declare each event once and route it through one dispatch step](gateway-handler-template/issues/02-event-declarations-and-guarded-dispatch.md)                        | —         |
| gateway-handler-template    | 01  | [Test that every event rejects the wrong room](gateway-handler-template/issues/01-authorization-characterization-spec.md)                                              | —         |
| props-refactor              | 03  | [The Control panel prop replaces the 32-field sidebar interface](props-refactor/issues/03-control-panel-prop.md)                                                       | —         |
| props-refactor              | 06  | [The question display takes a question object](props-refactor/issues/06-question-display-takes-question.md)                                                            | —         |
| props-refactor              | 05  | [The /control question browser takes the admin indicators object](props-refactor/issues/05-question-browser-takes-admin-indicators.md)                                 | —         |
| props-refactor              | 02  | [One shared function for the admin controls, used by /control and /remote](props-refactor/issues/02-shared-admin-controls.md)                                          | —         |
| props-refactor              | 04  | [Rules content and the phone's game status screens take the session settings object](props-refactor/issues/04-rules-content-takes-settings.md)                         | —         |
| props-refactor              | 01  | [The admin view decides showdown eligibility and last-question-before-break](props-refactor/issues/01-server-decided-showdown-and-break-flags.md)                      | —         |
| role-socket-hooks           | 06  | [Display game hook; delete the three-room hook and the legacy "exception" emit](role-socket-hooks/issues/06-display-hook-and-contract.md)                              | `7134768` |
| role-socket-hooks           | 04  | [Shared admin-session connection hook; /remote moves to the admin game hook](role-socket-hooks/issues/04-admin-session-connection-remote.md)                           | —         |
| role-socket-hooks           | 03  | [Player game hook; /play and the join flow switch over](role-socket-hooks/issues/03-player-game-hook-play.md)                                                          | —         |
| role-socket-hooks           | 02  | [Admin game hook on a shared connection core; /control switches over](role-socket-hooks/issues/02-admin-game-hook-control.md)                                          | —         |
| role-socket-hooks           | 01  | [Every socket event answers with an acknowledgement result](role-socket-hooks/issues/01-acknowledge-every-socket-event.md)                                             | —         |
| standings-module            | 06  | [Stats list reads Standings](standings-module/issues/06-stats-list-reads-standings.md)                                                                                 | —         |
| standings-module            | 05  | [Stats detail with the participation rule, departed teams and one winner](standings-module/issues/05-stats-detail-participation-and-winner.md)                         | —         |
| standings-module            | 04  | [Display and phone overlay render server ranks](standings-module/issues/04-display-and-phones-render-server-ranks.md)                                                  | —         |
| standings-module            | 03  | [Teams table renders server standings; roster changes refresh them](standings-module/issues/03-teams-table-renders-server-standings.md)                                | —         |
| standings-module            | 02  | [Live leaderboard served by the Standings service](standings-module/issues/02-live-leaderboard-from-standings.md)                                                      | —         |
| standings-module            | 01  | [Ranking rule prefactor](standings-module/issues/01-ranking-rule-prefactor.md)                                                                                         | —         |
| live-session-module         | 01  | [Real-store gateway test harness](live-session-module/issues/01-real-store-gateway-harness.md)                                                                         | `e9af2e9` |
| live-session-module         | 02  | [Outcome delivery step; timers share the Advance path](live-session-module/issues/02-outcome-delivery-and-timers.md)                                                   | `66ddeb5` |
| live-session-module         | 03  | [Answer recorded / answer graded owned by the Live session module](live-session-module/issues/03-answer-recorded-and-graded.md)                                        | `22dad1f` |
| live-session-module         | 04  | [Team removed (kick / leave)](live-session-module/issues/04-team-removed.md)                                                                                           | `6f17212` |
| live-session-module         | 05  | [Bonus changed and leaderboard toggle](live-session-module/issues/05-bonus-changed-and-leaderboard-toggle.md)                                                          | `adc82fe` |
| live-session-module         | 06  | [Quiz edited (live answer-key fix)](live-session-module/issues/06-quiz-edited-regrade.md)                                                                              | `08a7de8` |
| live-session-module         | 07  | [Remaining events through the module; delete the pass-through setters](live-session-module/issues/07-remaining-events-and-delete-setters.md)                           | `2b7edc4` |
| live-session-module         | 08  | [Migrate game-flow specs to the real-store harness](live-session-module/issues/08-migrate-game-flow-specs.md)                                                          | —         |
| live-session-module         | 09  | [Migrate grading, answers and team specs to the real-store harness](live-session-module/issues/09-migrate-grading-and-team-specs.md)                                   | —         |
| live-session-module         | 10  | [Contract: delete the fake-store harness](live-session-module/issues/10-contract-delete-fake-harness.md)                                                               | —         |
| scoring-module              | 01  | [Scoring module prefactor](scoring-module/issues/01-scoring-module-prefactor.md)                                                                                       | —         |
| scoring-module              | 02  | [Kahoot speed from stored response time](scoring-module/issues/02-kahoot-speed-from-response-time.md)                                                                  | —         |
| scoring-module              | 03  | [Stored verdict and verdict-based correct-count on /control and /remote](scoring-module/issues/03-stored-verdict-and-admin-correct-count.md)                           | —         |
| scoring-module              | 04  | [Stats read the verdict](scoring-module/issues/04-stats-read-verdict.md)                                                                                               | —         |
| scoring-module              | 05  | [Team phones: synced closest_guess points and the verdict](scoring-module/issues/05-team-phones-synced-points-and-verdict.md)                                          | —         |
| scoring-module              | 06  | [Align half points and sort comparison](scoring-module/issues/06-align-half-points-and-sort.md)                                                                        | —         |
| scoring-module              | 07  | [Quiz editor: kahoot type picker and toggle guard](scoring-module/issues/07-editor-kahoot-picker-and-toggle.md)                                                        | —         |
| screen-projection           | 01  | [Players view hides the kahoot question behind the leaderboard](screen-projection/issues/01-players-view-redacts-hidden-kahoot-question.md)                            | —         |
| screen-projection           | 02  | [Named on-air screen drives the big screen](screen-projection/issues/02-named-on-air-screen-drives-display.md)                                                         | —         |
| screen-projection           | 03  | [Presenter preview built from the projection](screen-projection/issues/03-presenter-preview-from-projection.md)                                                        | —         |
| screen-projection           | 04  | [Admin view: the question on display and the round indicators](screen-projection/issues/04-admin-view-on-display-question-and-indicators.md)                           | —         |
| screen-projection           | 05  | [Advance/Previous availability decided server-side](screen-projection/issues/05-advance-legality-server-side.md)                                                       | —         |
| screen-projection           | 06  | [Players view: answerability and the question on screen](screen-projection/issues/06-players-view-answerability-and-on-screen-question.md)                             | —         |

## Won't do

| Feature           | #   | Ticket                                                                                                            | Why                                                                       |
| ----------------- | --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| role-socket-hooks | 05  | [Control panel context replaces the 34-field sidebar props](role-socket-hooks/issues/05-control-panel-context.md) | Marked `wontfix`; props-refactor 03's single Control panel prop covers it |
