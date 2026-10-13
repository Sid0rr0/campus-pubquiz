# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                      | Title                                                                                                               | Tickets | Blocked by                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------ |
| block-grading-moves       | [Give Block grading one entry point per move](block-grading-moves/spec.md)                                          | 2       | —                              |
| reveal-kind               | [Let the reveal view say what kind of reveal it is](reveal-kind/spec.md)                                            | 2       | answer-key 01 (ticket 01 only) |
| phone-question-browser    | [Move phone question browsing out of /play, and narrow the Team link hook](phone-question-browser/spec.md)          | 3       | —                              |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
