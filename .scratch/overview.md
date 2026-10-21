# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                       | Title                                                                                     | Tickets | Blocked by |
| -------------------------- | ----------------------------------------------------------------------------------------- | ------- | ---------- |
| question-outcome-module    | [One Question outcome module for how a question went](question-outcome-module/spec.md)    | 3       | —          |
| prior-standings-trends     | [Prior standings as the only trend basis](prior-standings-trends/spec.md)                 | 2       | —          |
| host-only-text             | [One host-only text rule per On-air screen](host-only-text/spec.md)                       | 2       | —          |
| ended-night-read           | [One ended-night read for the stats page and the Team page](ended-night-read/spec.md)     | 2       | —          |
| live-session-summary       | [The live session summary is built where the session lives](live-session-summary/spec.md) | 2       | —          |
| admin-control-availability | [Control availability comes with the admin view](admin-control-availability/spec.md)      | 2       | —          |
| touched-scores             | [Each change says whether it touched scores](touched-scores/spec.md)                      | 2       | —          |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
