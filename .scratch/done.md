# Done specs

Specs whose tickets are all finished, newest first. Open work lives in [`overview.md`](overview.md). A spec is unblocked once everything in its "Blocked by" column appears here.

| Spec                        | Title                                                                                                                                                               | Tickets |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
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
