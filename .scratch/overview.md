# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec | Title | Tickets | Blocked by |
| ---- | ----- | ------- | ---------- |
| session-change-cleanup | [Every session write reads live results; one-caller session updates inlined](session-change-cleanup/spec.md) | 2 | team-view-projection |
| team-view-projection | [One team view projection for the phone](team-view-projection/spec.md) | 5 | — |
| transition-rules | [One transition rules module for what a move sets off](transition-rules/spec.md) | 4 | team-view-projection |
| doubled-points-one-step | [Joker doubling goes through one shared step](doubled-points-one-step/spec.md) | 1 | — |
| declared-socket-changes | [Each socket event declaration names its session change](declared-socket-changes/spec.md) | 3 | session-change-cleanup |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
