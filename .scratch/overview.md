# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                            | Title                                                                                                                                                                      | Tickets | Blocked by |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| reconnect-resilience | [The big screen and the phones survive a dropped connection](reconnect-resilience/spec.md) | 4 | — |
| break-fun-facts | [Fun facts on the big screen during a break](break-fun-facts/spec.md) | 2 | — |
| feedback-trends | [Feedback trends across sessions](feedback-trends/spec.md) | 3 | — |
| team-page | [A team page opened with the team code](team-page/spec.md) | 3 | — |
| league | [Leagues — ranking teams across a semester](league/spec.md) | 6 | team-page, feedback-trends |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
