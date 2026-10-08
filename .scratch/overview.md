# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                   | Title                                                                                                                       | Tickets | Blocked by             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| leaderboard-rows       | [Leaderboard row selection is a pure module, apart from the leaderboard view](leaderboard-rows/spec.md)                     | 3       | —                      |
| session-write-module   | [The Session write is its own module](session-write-module/spec.md)                                                         | 2       | —                      |
| live-session-changes   | [Live session events are built by per-domain change modules](live-session-changes/spec.md)                                  | —       | session-write-module   |
| live-edit-owns-quiz-edit | [The Live edit module owns the quiz edit, its hold and the live-edit frontier](live-edit-owns-quiz-edit/spec.md) | 4       | session-write-module (tickets 03–04 only) |
| quiz-editor-split      | [Split the quiz editor panel into a draft hook, an import hook and pure round edits](quiz-editor-split/spec.md)             | 3       | —                      |
| phase-timers           | [Phase timers are their own module, apart from the gateway](phase-timers/spec.md)                                           | 1       | —                      |
| sortable-table         | [One sortable table module across five panels, and a smaller session picker](sortable-table/spec.md)                        | —       | —                      |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
