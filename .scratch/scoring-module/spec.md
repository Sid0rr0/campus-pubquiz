# Spec: One Scoring module per question type

Status: ready-for-agent

## Problem Statement

Quiz masters and teams see scores and "correct" labels that disagree depending on where they look, and some kahoot corrections silently lose points after a backend restart.

- **Kahoot answers are never "correct" on /control and /remote.** Speed scaling almost always awards less than full points, and those screens count an answer as correct only when it received exactly the question's full points. A room of teams who all got the kahoot question right shows "0 correct".
- **"Correct" means three different things.**
  - The control panel and remote: "full points".
  - Session stats: "any points" (so partial match credit counts).
  - Team phones: closest_guess is re-derived by looking up their team name in the reveal data.

  The same answer can be correct on one screen and not on another.
- **Kahoot corrections after a restart lose speed scaling.** When the quiz master fixes a kahoot question's answer key after the backend restarted, every re-scored answer gets full unscaled points. The speed data only ever lived in memory. CLAUDE.md records this as an accepted tradeoff, but it was only accepted because response time was being read from a timestamp the scoring itself overwrites. The per-answer response time is already stored at submit.
- **Correcting a kahoot question before it locks is fragile.** The regrade has to skip it specially, because re-scoring would bump the timestamp that speed scoring later reads as "response time".
- **Half points differ between the admin and the automatic scoring.** The admin's "Half" quick button awards unrounded half points (1.5 of 3). Match all-or-nothing scoring awards rounded half points (2 of 3). The two disagree.
- **The kahoot eligibility rule is stated wrongly.** The kahoot-allowed list is documented as "types that grade themselves at submit", but free_text now grades itself at submit and is (deliberately) still not allowed in kahoot rounds. Contract comments also still describe free_text as admin-graded.
- **Every new scoring knob touches about a dozen places.** Adding the match scoring mode meant threading one more positional argument through three public grading operations and every caller that unpacks a question field by field.

## Solution

A single Scoring module owns every question type's scoring rule. It is pure: no database. It lives in shared types so backend, quiz editor and control panel all read the same rules.

- **Input:** a whole question plus one submission and its stored response time.
- **Output:** the points and a verdict: correct, partial or incorrect.

The verdict is stored with the answer whenever points are written (auto-grading, kahoot speed scoring, regrade, closest_guess batch, manual grading), so every screen and stats read the same verdict instead of inferring it from points.

Kahoot speed scaling reads the response time stored at submit. A kahoot answer re-scored after a restart, or corrected before lock, gets the same speed-scaled points it would have gotten without the restart.

## User Stories

1. As a quiz master, I want a kahoot answer that got the question right to count as correct on /control, so that the correct-count reflects reality in kahoot rounds.
2. As a quiz master using /remote, I want the same correct-count as /control, so that both admin views agree.
3. As a quiz master, I want a match answer with some pairs right to be labelled partial rather than correct or incorrect, so that I can see at a glance who was close.
4. As a quiz master, I want the correct-count on the grading panel to update when I override an answer's points, so that an accepted synonym for free text counts as correct.
5. As a quiz master, I want overriding to full points to mark an answer correct, overriding to zero to mark it incorrect, and anything between to mark it partial, so that my manual grading uses the same vocabulary as auto-grading.
6. As a quiz master, I want the "Half" quick button to award the same half points that match all-or-nothing scoring awards, so that half credit means one thing.
7. As a quiz master, I want correcting a kahoot question's answer key after a backend restart to keep each team's speed scaling, so that a redeploy mid-quiz doesn't hand everyone full points.
8. As a quiz master, I want correcting a kahoot question's answer key before it locks to be graded with speed scaling at lock, so that early corrections don't need special care.
9. As a quiz master, I want kahoot rounds to keep accepting only multiple_choice, sort and match, so that speed rounds stay pick-or-arrange questions and never hinge on typing speed or spelling.
10. As a quiz editor, I want the editor to allow and reject kahoot question types by the same rule the backend enforces, so that I never save a quiz that fails at import or on stage.
11. As a quiz editor, I want the question-type picker in a kahoot-mode round to offer only kahoot-allowed types, so that I can't pick a type the round will reject.
12. As a quiz editor, I want the kahoot mode toggle disabled on a round that holds any disallowed question, with a hint naming which questions block it, so that I change or remove them myself and never lose an answer key to an automatic type change.
13. As a quiz editor, I want turning kahoot mode off again to bring every question type back in that round's pickers, so that toggling is freely reversible.
14. As a team, I want my phone to show the points I actually got for a closest_guess question, taken from my synced graded answers, so that my score never depends on my team name matching the reveal list.
15. As a team, I want my phone to show whether my answer was correct, partial or incorrect using the same verdict the quiz master sees, so that there's no argument at the bar.
16. As a team, I want a kahoot answer I resubmitted before lock to be timed from my last submission, exactly as today, so that revising an answer keeps today's rules.
17. As a team, I want a kahoot answer submitted when no question timer is configured to keep full points, exactly as today, so that unlimited rounds aren't penalised.
18. As a team, I want a wrong kahoot answer to stay at zero whatever my speed, exactly as today.
19. As a team, I want sort answers compared the same tolerant way match answers are (surrounding whitespace and empty items ignored), so that a formatting quirk doesn't cost me a sort question.
20. As a quiz master reviewing stats, I want a question's correct-count to use the stored verdict, so that stats agree with what the grading panel showed live.
21. As a quiz master reviewing stats for kahoot rounds, I want speed-scaled correct answers counted as correct, so that kahoot rounds don't look impossibly hard.
22. As a quiz master reviewing stats, I want match questions' rate to stay points-based as today, so that partial credit remains visible in the per-question rate.
23. As a quiz master reviewing old sessions, I want answers graded before this change to get a sensible verdict derived from their points, so that historical stats keep working.
24. As a developer, I want adding a scoring option to a question type to touch only the Scoring module and the question's own schema, so that knobs like the match scoring mode don't thread through every caller.
25. As a developer, I want the grading operations to take the whole question rather than type, answer, points and mode as separate arguments, so that signatures stop growing.
26. As a developer, I want kahoot speed multipliers to disappear from in-memory session state, so that there's no data a restart can lose.
27. As a developer, I want the set of types graded at submit, batch-graded, and human-graded to be declared once in the Scoring module, so that kahoot eligibility, auto-grading and override rules can't drift apart.
28. As a developer, I want every rule for every type testable as a pure table of inputs to points and verdict, so that scoring edge cases are cheap to cover.
29. As a developer, I want the contract comments describing which types need admin grading to match reality, so that the socket contract isn't misleading.

## Implementation Decisions

- **Scoring module in shared types.** A pure module (no I/O) owns, per question type:
  - the auto-grade rule
  - the "half points" rule
  - the type's grading category: graded at submit (multiple_choice, sort, match, free_text), graded in a batch (closest_guess), human-graded (audio, youtube)

  It is the single source for the auto-graded-types list, the kahoot-allowed-types list (declared explicitly as multiple_choice, sort and match; free_text is graded at submit but deliberately excluded) and "can be overridden manually" (everything except closest_guess).
- **Interface.** Callers pass the whole question: its type, answer key, points, and per-type options such as the match scoring mode. The interface has three operations:
  - **score a submission** (plus optional speed context) → points and verdict
  - **verdict for a manual grade** → points relative to the question's points: full → correct, zero → incorrect, otherwise partial
  - **grade a batch** of closest_guess submissions → per-submission points and verdict

  Speed context is the response time in milliseconds and the configured kahoot timer, or none.
- **Kahoot speed formula is unchanged:** `points × (1 − min(max(responseMs / timerMs, 0), 1) / 2)`, rounded. With no timer, speed isn't applied. With no stored response time (legacy rows), no scaling is applied. Speed never changes the verdict: a correct kahoot answer stays correct.
- **Response time source.** Kahoot speed uses the response time stored on the answer at submit. It is measured from the same phase start today's formula uses, and is overwritten on every resubmission, so "last submission" timing is preserved. Reading the row's update timestamp for timing is removed.
- **No in-memory multipliers.** The session's in-memory per-question speed multipliers are removed. Kahoot scoring at lock and later regrades both recompute from stored response times, and scoring stays idempotent. The regrade no longer skips kahoot questions that haven't been speed-scored yet. The "has this kahoot question been speed-scored" guard becomes a status-transition check only.
- **Verdict persisted.** The answer record gains a nullable verdict field (correct / partial / incorrect; null while ungraded), written together with points and graded-at on every grading path. A migration backfills graded historical rows from points: at or above the question's points → correct, zero → incorrect, otherwise partial. Historical kahoot answers therefore backfill as partial, which is accepted.
- **Answer-carrying socket payloads gain the verdict.** These are the submit acknowledgement, the admin answer list and the per-team answer sync. Clients read it instead of comparing points. Stats' session detail also reads it.
- **Grading interface shrinks.** The answer module's grading operations (submit, regrade after a live edit, kahoot speed scoring, closest_guess batch) take a question value instead of separate positional type/answer/points/mode arguments, and call the Scoring module.
- **Behaviour changes, deliberate:**
  - the "Half" button uses the shared half-points rule (rounded, matching match all-or-nothing)
  - sort compares normalised pipe lists the same way match does
  - stats' correct-count counts only verdict correct; partial no longer counts toward it, while match's points-based rate is unchanged
- **Team phones stop re-deriving closest_guess points by team name.** They use the graded answers already synced at reveal entry.
- **Kahoot eligibility is unchanged:** multiple_choice, sort and match only; free_text stays excluded. The editor schema and import both read the Scoring module's explicit list, and its documentation states the real rule instead of "grades itself at submit" (see ADR 0001).
- **Quiz editor type picker is filtered by round.** In a kahoot-mode round, each question's type picker offers only the kahoot-allowed types from the Scoring module. New questions added to a kahoot round default to an allowed type, as today. Turning kahoot mode off restores the full picker.
- **Kahoot toggle disabled by disallowed questions.** While a round holds any question of a disallowed type, its kahoot mode toggle can't be switched on. It shows a short hint naming the blocking questions (by position in the round), and becomes enabled as soon as none remain. Turning kahoot mode off is always allowed. Question types and fields are never changed automatically. The existing save-blocking validation stays as a backstop for any quiz that reaches the editor already in that state.
- **Contract comments** that describe free_text as admin-graded are corrected.
- **Accepted tradeoff narrowed.** The CLAUDE.md "Known Tradeoffs" entry about kahoot multipliers living in memory is reduced to the part that still holds: live answer-key fixes overwrite manual overrides.

## Testing Decisions

- **Seam 1: the Scoring module's interface.** This covers every rule as table-driven tests of inputs → points + verdict:
  - every type
  - match in both scoring modes, with 0/1/n wrong pairs
  - free_text normalisation
  - sort normalisation
  - kahoot speed at 0, mid, at-timer, past-timer, no timer, no response time
  - wrong kahoot answers
  - closest_guess batches with ties, non-numeric guesses and no submissions
  - manual-grade verdicts at 0, between, full, and above full
  - the category lists (auto-graded, kahoot-allowed, overridable), including that free_text is auto-graded but not kahoot-allowed

  Tests assert only returned values.
- **Seam 2: the answer module on Postgres (existing seam).** This covers persistence and wiring:
  - the stored verdict on every grading path
  - kahoot speed computed from stored response time
  - a kahoot answer-key regrade producing identical speed-scaled points when run from a freshly constructed module instance with no prior in-memory state (the restart case)
  - resubmission timing
  - the verdict backfill migration on pre-existing rows
- **What makes a good test here.** It feeds realistic submissions in and checks points and verdict out, never which helper was called. Existing answer-module specs that assert positional arguments are rewritten to assert stored results.
- **Quiz editor:** Vitest component tests through the quiz editor panel: toggling kahoot mode on hides disallowed types from that round's pickers only (other rounds unaffected); a round holding a free_text question has its kahoot toggle disabled with a hint naming that question, and the toggle enables once the question is changed to an allowed type or deleted; toggling off restores all types. Prior art: the existing quiz editor panel and draft-state tests.
- **Frontend:** the existing Vitest component/unit tests for the control grading panel, the correct-count helper, the remote view and the team's opened-questions list are updated to read the verdict. Stats session-detail calculation tests are updated for the verdict-based correct-count.
- **Prior art:**
  - the answer module's existing testcontainer specs (auto-grading, grading, submit-and-list)
  - the shared-types pure reducer tests as the model for table-driven pure tests
  - the stats session-detail calculation specs

## Out of Scope

- Changing how the Live session module refreshes leaderboards or pushes outcomes (separate Live session spec). This spec only changes what grading computes and stores.
- Changing the kahoot speed formula itself, or the closest_guess "all tied closest get full points" rule.
- Round-level stats rate consistency and the stats winner/participation rules (candidate "Standings module").
- Per-room redaction of snapshots (candidate "Screen projection").
- Attributing grades to a user (`gradedBy`).
- Recomputing exact historical kahoot verdicts. They backfill as partial.

## Further Notes

- This is candidate 02 from the 2026-09-30 architecture review.
- It overlaps with the Live session spec only at the grading operations the Live session module calls. If both run concurrently, the Live session tickets should call grading through the question-value interface this spec introduces, so whichever lands second rebases onto the other's signature.
- Stats will show a lower correct-count for match questions where partial credit was previously counted. That is intended, since "correct" now means one thing everywhere. Worth a line in the release notes for quiz masters who compare old and new sessions.
