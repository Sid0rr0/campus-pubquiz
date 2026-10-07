# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                   | Title                                                                                                                       | Tickets | Blocked by             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------- |
| room-view-projection   | [One room-view projection shared by the server and the frontend fixtures](room-view-projection/spec.md)                     | 6       | socket-protocol 01, 04 |
| outcome-deadlines      | [Deadline changes travel on the SessionOutcome, and the pass-through socket handlers go](outcome-deadlines/spec.md)         | 3       | —                      |
| block-membership       | [Block membership is its own rule, and the reveal views are built on it](block-membership/spec.md)                          | 3       | —                      |
| delete-middle-question | [Deleting a middle question from a round saves](delete-middle-question/spec.md)                                             | 1       | —                      |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
