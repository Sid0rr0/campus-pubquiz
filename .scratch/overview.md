# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                            | Title                                                                                                                                                                      | Tickets | Blocked by |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| question-record-module | [One Question record codec for every shape a question takes](question-record-module/spec.md) | 5 | — |
| display-screen-content | [The big screen and the phones draw what they are sent](display-screen-content/spec.md) | 5 | — |
| ended-sessions-read | [One Ended-sessions read for which nights count and who took part](ended-sessions-read/spec.md) | 4 | session-result-module (tickets 03–04 only; 01–02 can start now) |
| live-results-read | [One live results read in place of the with* helpers](live-results-read/spec.md) | 2 | — |
| question-kind-derived-lists | [The question type registry derives every per-type list](question-kind-derived-lists/spec.md) | 3 | — |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
