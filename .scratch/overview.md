# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                  | Title                                                                                                                       | Tickets | Blocked by             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| live-edit-save        | [A live quiz save is checked and applied inside the live sessions' writes](live-edit-save/spec.md)                          | 4       | —                      |
| grading-policy        | [Grading policy in one module — key-fix regrades and the Grading refresh behind a narrow interface](grading-policy/spec.md) | 3       | —                      |
| room-view-projection  | [One room-view projection shared by the server and the frontend fixtures](room-view-projection/spec.md)                     | 6       | socket-protocol 01, 04 |
| outcome-deadlines     | [Deadline changes travel on the SessionOutcome, and the pass-through socket handlers go](outcome-deadlines/spec.md)         | 3       | —                      |
| block-membership      | [Block membership is its own rule, and the reveal views are built on it](block-membership/spec.md)                          | 3       | —                      |
| team-link             | [A Team link module for the phone's join and rejoin lifecycle](team-link/spec.md)                                           | 3       | —                      |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
