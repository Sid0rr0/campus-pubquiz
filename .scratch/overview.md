# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec | Title | Tickets | Blocked by |
| ---- | ----- | ------- | ---------- |
| display-screen-adapters | [Big-screen screens draw their Display screen directly](display-screen-adapters/spec.md) | 2 | — |
| clue-answer-module | [One Clue answer module for the freeze rule and an answer's worth](clue-answer-module/spec.md) | 2 | grading-policy-graded-as |
| doubled-rounds-owns-never-doubled | [The Doubled rounds module owns "never doubled"](doubled-rounds-owns-never-doubled/spec.md) | 2 | — |
| one-team-answer-record | [One record per team answer on the phone](one-team-answer-record/spec.md) | 1 | clue-answer-module |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
