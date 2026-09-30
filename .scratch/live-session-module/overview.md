# Live session module: ticket overview

Spec: [spec.md](spec.md). Tickets live in [issues/](issues/). A ticket is unblocked once everything in its "Blocked by" column is under **Done**.

## Not implemented

| #   | Ticket                                                                                                                   | Blocked by     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| 02  | [Outcome delivery step; timers share the Advance path](issues/02-outcome-delivery-and-timers.md)                         | 01             |
| 03  | [Answer recorded / answer graded owned by the Live session module](issues/03-answer-recorded-and-graded.md)              | 02             |
| 04  | [Team removed (kick / leave)](issues/04-team-removed.md)                                                                 | 02             |
| 05  | [Bonus changed and leaderboard toggle](issues/05-bonus-changed-and-leaderboard-toggle.md)                                | 02             |
| 06  | [Quiz edited (live answer-key fix)](issues/06-quiz-edited-regrade.md)                                                    | 03             |
| 07  | [Remaining events through the module; delete the pass-through setters](issues/07-remaining-events-and-delete-setters.md) | 03, 04, 05, 06 |
| 08  | [Migrate game-flow specs to the real-store harness](issues/08-migrate-game-flow-specs.md)                                | 01             |
| 09  | [Migrate grading, answers and team specs to the real-store harness](issues/09-migrate-grading-and-team-specs.md)         | 01             |
| 10  | [Contract: delete the fake-store harness](issues/10-contract-delete-fake-harness.md)                                     | 07, 08, 09     |

## Done

| #   | Ticket                                                                     | Commit    |
| --- | -------------------------------------------------------------------------- | --------- |
| 01  | [Real-store gateway test harness](issues/01-real-store-gateway-harness.md) | `e9af2e9` |
