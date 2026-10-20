# Done specs

Specs whose tickets are all finished, newest first. Open work lives in [`overview.md`](overview.md). A spec is unblocked once everything in its "Blocked by" column appears here.

| Spec                        | Title                                                                                                                                                               | Tickets |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| live-results-read | [One live results read in place of the with* helpers](live-results-read/spec.md) | 2 |
| ended-sessions-read | [One Ended-sessions read for which nights count and who took part](ended-sessions-read/spec.md) | 4 |
| display-screen-content | [The big screen and the phones draw what they are sent](display-screen-content/spec.md) | 5 |
| question-record-module | [One Question record codec for every shape a question takes](question-record-module/spec.md) | 5 |
| session-result-module | [One Session result module for what a night's results mean](session-result-module/spec.md) | 4 |
| league | [Leagues — ranking teams across a semester](league/spec.md) | 6 |
| team-page | [A team page opened with the team code](team-page/spec.md) | 3 |
| feedback-trends | [Feedback trends across sessions](feedback-trends/spec.md) | 3 |
| e2e-journeys-2 | [E2E coverage of a whole quiz night](e2e-journeys-2/spec.md) | 15 |
| display-portrait-margin | [Portrait question images that fit, and a margin that explains itself](display-portrait-margin/spec.md) | 4 |
| guide-trim | [A shorter moderator guide](guide-trim/spec.md) | 1 |
| round-notes | [Round notes on title cards](round-notes/spec.md) | 3 |
| video-files | [Video files as media](video-files/spec.md) | 3 |
| media-not-a-question-type | [Media is something any question carries, not a question type](media-not-a-question-type/spec.md) | 3 |
| youtube-clips | [YouTube clips, reveal clips and hidden videos](youtube-clips/spec.md) | 3 |
| break-fun-facts | [Fun facts on the big screen during a break](break-fun-facts/spec.md) | 2 |
| reconnect-resilience | [The big screen and the phones survive a dropped connection](reconnect-resilience/spec.md) | 4 |
| player-count-and-team-stats | [Player counts and a team stats page](player-count-and-team-stats/spec.md) | 5 |
| e2e-tests | [Browser end-to-end tests for a quiz night](e2e-tests/spec.md) | 5 |
| player-polish | [Player polish — motion, sound and haptics for the big moments](player-polish/spec.md) | 9 |
| stats-read-standings | [Stats take totals from the Standings module and credit answers by verdict](stats-read-standings/spec.md) | 2 |
| question-record-codec | [One stored-question codec — a question crosses storage, preview and the seeded game in one place](question-record-codec/spec.md) | 3 |
| phone-browse-back-closest-guess | [A closest_guess question browsed back to on the phone shows fully revealed](phone-browse-back-closest-guess/issues/01-browsed-back-closest-guess-shows-fully-revealed.md) | 1 |
| grading-state | [The Grading policy decides whether an answer can be graded now, for the clients too](grading-state/spec.md) | 3 |
| leaderboard-before-board | [The server sends the leaderboard's "before" board](leaderboard-before-board/spec.md) | 2 |
| frontend-happy-dom | [The frontend suite runs on happy-dom instead of jsdom](frontend-happy-dom/spec.md) | 3 |
| session-quiz-copy | [Every session holds the current quiz, and grading reads only that copy](session-quiz-copy/spec.md) | 2 |
| closest-guess-reveal-module | [One Closest-guess reveal module owns the reveal steps](closest-guess-reveal-module/spec.md) | 3 |
| reveal-kind | [Let the reveal view say what kind of reveal it is](reveal-kind/spec.md) | 2 |
| phone-question-browser | [Move phone question browsing out of /play, and narrow the Team link hook](phone-question-browser/spec.md) | 3 |
| block-grading-moves | [Give Block grading one entry point per move](block-grading-moves/spec.md) | 2 |
| session-broadcaster | [Split outbound broadcasting out of the GameGateway](session-broadcaster/spec.md) | 4 |
| real-store-harness-module | [Build the real-store harness from a Game module, not by hand](real-store-harness-module/spec.md) | 3 |
| answer-key | [One Answer key — what an answer is graded against, defaults filled in once](answer-key/spec.md) | 3 |
| grading-mode-policy | [One Grading policy per grading mode — every grading event decided in one pure module](grading-mode-policy/spec.md) | 3 |
| number-question | [Number question type, graded against a margin](number-question/spec.md) | 3 |
| sortable-table | [One sortable table module across five panels, and a smaller session picker](sortable-table/spec.md) | 3 |
| phase-timers | [Phase timers are their own module, apart from the gateway](phase-timers/spec.md) | 1 |
| quiz-editor-split | [Split the quiz editor panel into a draft hook, an import hook and pure round edits](quiz-editor-split/spec.md) | 3 |
| leaderboard-rows | [Leaderboard row selection is a pure module, apart from the leaderboard view](leaderboard-rows/spec.md) | 3 |
| join-overlay | [Join overlay and Previous back to the lobby](join-overlay/spec.md) | 3 |
| live-edit-owns-quiz-edit | [The Live edit module owns the quiz edit, its hold and the live-edit frontier](live-edit-owns-quiz-edit/spec.md) | 4 |
| live-session-changes | [Live session events are built by per-domain change modules](live-session-changes/spec.md) | 7 |
| session-write-module | [The Session write is its own module](session-write-module/spec.md) | 2 |
| block-membership | [Block membership is its own rule, and the reveal views are built on it](block-membership/spec.md) | 3 |
| outcome-deadlines | [Deadline changes travel on the SessionOutcome, and the pass-through socket handlers go](outcome-deadlines/spec.md) | 3 |
| delete-middle-question | [Deleting a middle question from a round saves](delete-middle-question/spec.md) | 1 |
| room-view-projection        | [One room-view projection shared by the server and the frontend fixtures](room-view-projection/spec.md)                                                             | 6       |
| grading-policy | [Grading policy in one module — key-fix regrades and the Grading refresh behind a narrow interface](grading-policy/spec.md) | 3 |
| live-edit-save              | [A live quiz save is checked and applied inside the live sessions' writes](live-edit-save/spec.md)                                                                      | 4       |
| question-answer-kinds       | [One answer kind per question, defined once for every surface](question-answer-kinds/spec.md)                                                                       | 4       |
| team-link                   | [A Team link module for the phone's join and rejoin lifecycle](team-link/spec.md)                                                                                   | 3       |
| socket-protocol             | [A typed socket protocol module, and socket-events split by concept](socket-protocol/spec.md)                                                                       | 4       |
| team-event-gates            | [Team events check whether they're allowed inside their session write](team-event-gates/spec.md)                                                                    | 5       |
| bonus-award-toast           | [Toast when a bonus award is given](bonus-award-toast/spec.md)                                                                                                      | 3       |
| half-points                 | [Half points are exactly half](half-points/spec.md)                                                                                                                 | 2       |
| live-structural-edits       | [Rename "locked" to "opened" in the live-edit path](live-structural-edits/issues/01-rename-locked-to-opened.md)                                                     | 5       |
| live-session-events         | [Team events go into the Live session module; the getters go](live-session-events/spec.md)                                                                          | 8       |
| feedback                    | [Teams rate the rounds and leave feedback from their phones](feedback/spec.md)                                                                                      | 7       |
| backend-test-speed          | [The backend suite runs in under a minute and never fails by chance](backend-test-speed/spec.md)                                                                    | 5       |
| session-write               | [Every change to a live session is one session write, ending with fresh standings](session-write/spec.md)                                                           | 8       |
| players-reveal-redaction    | [The players view redacts the reveal, and names the phone screen](players-reveal-redaction/spec.md)                                                                 | 4       |
| commit-a-move               | [Commit a move — one module from the Move plan to saved progress](commit-a-move/spec.md)                                                                            | 6       |
| grading-refresh             | [Every change to grades ends through one grading refresh](grading-refresh/spec.md)                                                                                  | 3       |
| round-title-card            | [One round title card component for round_intro, break_round_intro and reveal_intro](round-title-card/issues/01-shared-round-title-card.md)                         | 1       |
| rename-grading-status-group | [Rename the `grading` status group to name the break, not the act of grading](rename-grading-status-group/issues/01-rename-grading-group-to-break.md)               | 1       |
| typed-answer-grading        | [A typed answer that matches the key grades itself; anything else waits for the moderator](typed-answer-grading/issues/01-match-auto-grades-otherwise-moderator.md) | 1       |
| ungraded-source             | [One rule and one reader for "which questions are still ungraded"](ungraded-source/spec.md)                                                                         | 4       |
| phone-question-selection    | [One pure function decides which question a team's phone shows](phone-question-selection/spec.md)                                                                   | 2       |
| display-screen-kind         | [/display renders the On-air screen it is sent](display-screen-kind/spec.md)                                                                                        | 1       |
| moderator-guide             | [Rewrite `/guide` around the moderator's tasks, fed from the app's own sources](moderator-guide/issues/01-task-based-guide-from-shared-sources.md)                  | 1       |
| question-kind-module        | [One Question kind module per QuestionType](question-kind-module/spec.md)                                                                                           | 7       |
| session-settle              | [One settle step derives a session's fields; named status groups](session-settle/spec.md)                                                                           | 4       |
| advance-plan                | [One Move plan decides what Advance and Previous do](advance-plan/spec.md)                                                                                          | 5       |
| gateway-handler-template    | [Collapse the gateway's per-event handler template](gateway-handler-template/spec.md)                                                                               | 3       |
| props-refactor              | [Grouped Control panel props, and passing whole objects](props-refactor/spec.md)                                                                                    | 6       |
| role-socket-hooks           | [Role-shaped socket hooks and a Control panel context](role-socket-hooks/spec.md)                                                                                   | 5       |
| standings-module            | [One Standings module for participation, ranking and ties](standings-module/spec.md)                                                                                | 6       |
| live-session-module         | [Deepen the Live session module](live-session-module/spec.md)                                                                                                       | 10      |
| scoring-module              | [One Scoring module per question type](scoring-module/spec.md)                                                                                                      | 7       |
| screen-projection           | [A Screen projection per room](screen-projection/spec.md)                                                                                                           | 6       |
