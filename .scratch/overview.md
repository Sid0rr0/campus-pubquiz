# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec | Title | Tickets | Blocked by |
| ---- | ----- | ------- | ---------- |
| stats-played-questions | [Unplayed questions stay out of an ended session's stats](stats-played-questions/spec.md) | 2 | — |
| scoring-mode-registry | [The question type registry owns each type's scoring modes](scoring-mode-registry/spec.md) | 3 | none |
| saved-progress-restore | [Saved progress is one shape from save to restore](saved-progress-restore/spec.md) | 2 | none |
| team-seat-check | [One team-seat check for every team event](team-seat-check/spec.md) | 2 | none |
| phase-deadline-table | [One table of phase deadlines](phase-deadline-table/spec.md) | 2 | — |
| opened-question-fields | [The quiz editor and the live-edit guard share one opened-question rule](opened-question-fields/spec.md) | 2 | — |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
