# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                            | Title                                                                                                                                                                      | Tickets | Blocked by |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| phone-browse-back-closest-guess | [A closest_guess question browsed back to on the phone shows fully revealed](phone-browse-back-closest-guess/issues/01-browsed-back-closest-guess-shows-fully-revealed.md) | 1       | —          |
| question-record-codec           | [One stored-question codec — a question crosses storage, preview and the seeded game in one place](question-record-codec/spec.md)                                          | 3       | —          |
| stats-read-standings            | [Stats take totals from the Standings module and credit answers by verdict](stats-read-standings/spec.md)                                                                  | 2       | —          |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
