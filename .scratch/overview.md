# Ticket overview

Open tickets for every feature under `.scratch/`. A ticket is unblocked once every ticket in its "Blocked by" column appears in [`done.md`](done.md) (numbers refer to tickets in the same feature unless a feature is named). Each feature has a `spec.md` and an `issues/` folder.

## Not implemented

| Feature               | #   | Ticket                                                                                                                                           | Blocked by |
| --------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| team-event-gates      | 01  | [A last-second answer either counts or is refused](team-event-gates/issues/01-last-second-answer-counts-or-is-refused.md)                        | —          |
| team-event-gates      | 02  | [Showdown guesses and new showdown rounds are checked inside the write](team-event-gates/issues/02-showdown-guesses-checked-inside-the-write.md) | —          |
| team-event-gates      | 03  | [Grades and bonus awards land inside the write](team-event-gates/issues/03-grades-and-bonus-awards-inside-the-write.md)                          | 01         |
| team-event-gates      | 04  | [Join, leave and kick land in one order](team-event-gates/issues/04-join-leave-kick-in-one-order.md)                                             | —          |
| team-event-gates      | 05  | [Round ratings and the final form become Live session module events](team-event-gates/issues/05-ratings-and-final-form-are-module-events.md)     | —          |
| question-answer-kinds | 01  | [Answer kinds and answer formats, with scoring going through them](question-answer-kinds/issues/01-answer-kinds-and-formats.md)                  | —          |
| question-answer-kinds | 02  | [The phone and the answers list answer by answer kind](question-answer-kinds/issues/02-phone-and-answers-list-by-answer-kind.md)                 | 01         |
| question-answer-kinds | 03  | [The big screen asks and reveals by answer kind](question-answer-kinds/issues/03-big-screen-by-answer-kind.md)                                   | 01         |
| question-answer-kinds | 04  | [The quiz editor's answer section by answer kind](question-answer-kinds/issues/04-editor-answer-section-by-answer-kind.md)                       | 01         |
| live-edit-save        | 01  | [The editor and the guard read one round-editing description](live-edit-save/issues/01-one-round-editing-description.md)                         | —          |
| live-edit-save        | 02  | [The write queue can hold several sessions at once](live-edit-save/issues/02-queue-holds-several-sessions.md)                                    | —          |
| live-edit-save        | 03  | [An editor save is checked and applied inside the live sessions' writes](live-edit-save/issues/03-editor-save-inside-live-sessions-writes.md)    | 02         |
| live-edit-save        | 04  | [A re-import goes through the Live edit module](live-edit-save/issues/04-reimport-through-live-edit-module.md)                                   | 03         |

## Won't do

| Feature           | #   | Ticket                                                                                                            | Why                                                                       |
| ----------------- | --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| role-socket-hooks | 05  | [Control panel context replaces the 34-field sidebar props](role-socket-hooks/issues/05-control-panel-context.md) | Marked `wontfix`; props-refactor 03's single Control panel prop covers it |
