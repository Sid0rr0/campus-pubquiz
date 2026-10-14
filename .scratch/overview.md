# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec                            | Title                                                                                                                                                                      | Tickets | Blocked by |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| frontend-happy-dom              | [The frontend suite runs on happy-dom instead of jsdom](frontend-happy-dom/spec.md)                                                                                        | 3       | —          |
| grading-state                   | [The Grading policy decides whether an answer can be graded now, for the clients too](grading-state/spec.md)                                                               | 3       | —          |
| leaderboard-before-board        | [The server sends the leaderboard's "before" board](leaderboard-before-board/spec.md)                                                                                      | 2       | —          |
| phone-browse-back-closest-guess | [A closest_guess question browsed back to on the phone shows fully revealed](phone-browse-back-closest-guess/issues/01-browsed-back-closest-guess-shows-fully-revealed.md) | 1       | —          |
| question-record-codec           | [One stored-question codec — a question crosses storage, preview and the seeded game in one place](question-record-codec/spec.md)                                          | 3       | —          |
| session-quiz-copy               | [Every session holds the current quiz, and grading reads only that copy](session-quiz-copy/spec.md)                                                                        | 2       | —          |
| stats-read-standings            | [Stats take totals from the Standings module and credit answers by verdict](stats-read-standings/spec.md)                                                                  | 2       | —          |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
