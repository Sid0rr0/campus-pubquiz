# Spec: Give Block grading one entry point per move

Status: ready-for-agent

Source: architecture review 2026-10-13, candidate 05 ("Worth exploring", in-process). The [grading-mode-policy](../grading-mode-policy/spec.md) spec lists this as out of scope and says it becomes easier once that spec lands.

## Problem Statement

Block grading is the module that grades what a move implies: the kahoot speed scoring when a kahoot question leaves `locking`, the closest_guess batch when the block reaches a graded status, and the Grading refresh of the ungraded set inside a break. Its interface has seven public methods. Callers have to call them in the right order and with the right arguments:

- **The order is a rule callers must remember.** Commit a move calls speed scoring, then the batch, then the refresh. Placing a session (session creation and restart restore) calls the batch, then the refresh. The order matters, because the refresh must see the grades the speed scoring and the batch just wrote. It is written down only in comments at each call site, and two call sites already repeat it.
- **The reveal gate sits outside the module.** The check that refuses to leave a break for the reveal while any question is ungraded lives in Commit a move. It reads the ungraded set straight from the database through a Block grading method, and has to run before any grading write.
- **Callers pick through outputs they don't need.** Placing a session throws away the batch's stale answer lists, because no socket is connected yet, and nothing at the call site says that is deliberate.
- **The module has no test surface of its own.** Whether a move grades the right things in the right order is only visible through full gateway specs, and nothing names "what grading a move does" as one behaviour.

For a developer this means a new move kind, or a new grading step (another grading event, say), has to be added by hand at every call site, in the right place in the sequence. A missed or reordered step leaves /control showing a wrong ungraded set or a reveal unlocked too early.

## Solution

Callers tell Block grading which move happened, and the module runs the steps in order:

- **Grading a move:** given the session as it stood before the press and the progress the move leads to, run the reveal gate, then the kahoot speed scoring, then the closest_guess batch, then the Grading refresh. Return the graded session and the questions whose admin answer list is now stale.
- **Grading a placement:** given a session and the progress it is placed at (session creation or restart restore), rebuild the closest_guess summaries without re-scoring, then refresh the ungraded set. Return the session.

The two event-driven entry points (grades changed after an answer was stored or graded, and the regrade for a key fix after a live edit) stay as they are. The step methods and the database readers become private.

Quiz masters and teams see no difference: every move grades, refuses and refreshes exactly as it does today.

## User Stories

1. As a quiz master, I want leaving a break for the reveal to be refused while any question in the block is ungraded, exactly as today, so that a reveal never shows an ungraded answer.
2. As a quiz master, I want the refusal to name the ungraded questions, as today, so that /control can point me to them.
3. As a quiz master, I want a refused move to store nothing, as today, so that the session stays where it was and I can grade and try again.
4. As a quiz master, I want a kahoot question's points to be rescaled by answer speed when it leaves `locking`, exactly as today, so that kahoot rounds still reward fast answers.
5. As a quiz master, I want stepping back into `locking` and advancing again to recompute the same kahoot points, as today, so that PREVIOUS never changes a score.
6. As a quiz master, I want closest_guess questions to be batch-graded as soon as the block reaches a graded status, as today, so that their reveal shows the closest team.
7. As a quiz master, I want /control's answer list for a just-batch-graded question to be refreshed, as today, so that it stops showing rows as ungraded.
8. As a quiz master, I want the ungraded set on /control to be recomputed from the database whenever the block enters or stays in a break, as today, so that it is never stale after a move.
9. As a quiz master, I want the ungraded set to see the grades the speed scoring and the batch just wrote, so that a question graded by the move never shows as ungraded.
10. As a quiz master, I want a backend restart mid-quiz to rebuild the closest_guess summaries without re-scoring any question, as today, so that a restart never changes a score.
11. As a quiz master, I want a restored session's ungraded set to be right from its first snapshot, as today, so that /control shows what is left to grade straight away.
12. As a quiz master, I want a new session's placement in the lobby to do no grading work, as today, so that creating a session is quick and harmless.
13. As a quiz master, I want an auto-advance from the question lock or kahoot timer to grade exactly as my own Advance press does, so that timed and manual moves behave the same.
14. As a quiz master, I want answers stored or graded during a break to refresh only that question's ungraded entry, as today, so that grading one answer is cheap.
15. As a quiz master, I want a live key fix to keep re-grading shown questions exactly as today, so that a corrected answer key is applied to answers already in.
16. As a quiz master, I want the presenter preview to stay a dry run with no grading writes, as today, so that previewing "next" never grades anything.
17. As a developer, I want Commit a move to call one Block grading method per progress move, so that I can't get the step order wrong.
18. As a developer, I want placing a session to call one Block grading method, so that creation and restore share the same rule without repeating it.
19. As a developer, I want the reveal gate to live inside Block grading, so that "nothing ungraded leaving a break" sits next to the ungraded set it reads.
20. As a developer, I want the step methods and the database readers private, so that the interface says what a caller can ask for, not how it is done.
21. As a developer, I want the step order written once, in the module, so that comments at call sites stop being the only record of it.
22. As a developer adding a grading step, I want to add it in one place inside Block grading, so that every move picks it up.
23. As a developer, I want each entry point's behaviour tested through the real-store harness, so that the order rule is pinned by tests and not by comments.
24. As a developer, I want placing a session to state on purpose that it has no stale answer lists to push, so that dropping them is visibly intentional.

## Implementation Decisions

- **Block grading's public interface becomes four methods**, down from seven:
  - `gradeForMove(session, to)`: the session as it stood before the press (its progress is where the move starts) and the progress the move leads to. It runs, in this order:
    1. the reveal gate, which refuses with the existing ungraded-answers error naming the questions when the move goes from `break_intro` or `break` to `reveal_intro` and any question in the block in play is ungraded, read fresh from the database
    2. the kahoot speed scoring, when the move leaves `locking` in a kahoot round
    3. the closest_guess batch, when `to` is a graded status
    4. the Grading refresh of the whole block, when `to` is a break status

    It returns the graded session and `staleAnswerListIds`. The gate runs before any grading write, so a refused move writes nothing.
  - `gradeForPlacement(session, progress)`: the batch, which on placement only rebuilds summaries and never re-scores a question already graded, followed by the whole-block refresh. It returns the session alone. Stale answer lists are dropped here on purpose, because no socket is connected during placement and /control reads its answer list fresh when it connects. That reason moves from the caller's comment into the module.
  - `gradesChanged(session, questionIds)`: unchanged (the answer stored or graded path).
  - `regradeForKeyFix(reloaded, before, questionIds)`: unchanged (the quiz edit path).
- **Private now:** the speed scoring, the batch, the bulk refresh, the ungraded-set readers (both the per-question and the whole-block one), and the reveal gate. Their behaviour is unchanged. Only their visibility and their caller change.
- **`canBeUngraded` stays an exported function** for now. The grading-mode-policy spec replaces it with the policy's "can be ungraded"; this spec doesn't touch it.
- **Commit a move:** a progress move calls `gradeForMove` once, then settles, saves and builds its outcome from `staleAnswerListIds` as today. Its own reveal-gate method is removed. `place()` calls `gradeForPlacement` once. The other move kinds (showdown steps, closest_guess reveal steps) still do no grading. The presenter preview still calls no grading.
- **No change** to the session shape, the outcome shape, persistence, the socket protocol or shared types.
- **Docs:** add the reveal gate to GLOSSARY's **Commit a move** entry ("…grade what it implies (refused while anything is ungraded when leaving a break for the reveal)…"), or to a short **Reveal gate** entry if none covers it. If the architecture diagram's Block grading node lists its steps, show the two move entry points. DOCUMENTATION.md and the /guide page are unaffected, since behaviour doesn't change.

## Testing Decisions

- **What makes a good test here:** it drives a real move through the gateway and asserts on what clients see and what the database holds. That means the ungraded set in the admin snapshot, the refusal ack, the points in answer lists and the closest_guess reveal. It never asserts on which Block grading method ran or how often. A behaviour-preserving refactor proves itself when the existing specs pass with unchanged assertions.
- **Seam: the existing real-store harness, and no new seam.** Every Block grading behaviour is already reachable through admin actions, timer expiries, `restart()` and `saveQuizEdit`. Block grading is not given a mocked unit spec, because its value is in its database reads and writes.
- **Existing specs that must pass unchanged:** grading gate, ungraded agreement, ungraded restore, kahoot answer speed, kahoot question auto-advance, closest_guess reveal, question lock auto-advance, previous-to-lobby, persistence and quiz selection, live-edit regrade, core snapshot (which constructs Block grading directly; it updates its calls only if it used a now-private method).
- **New cases**, written test-first through the harness, one per ordering rule the module now owns:
  - leaving `break` for the reveal with an ungraded question is refused, and nothing is graded or saved: the session stays in `break` and the ungraded set is unchanged after the refusal
  - a block ending on a closest_guess question enters its break with that question absent from the ungraded set and its admin answer list re-sent (the batch runs before the refresh)
  - a kahoot block whose last question leaves `locking` straight into its break shows speed-scaled points in the answer lists and a correct ungraded set (speed scoring runs before the refresh)
  - a restart while in a break restores the ungraded set and the closest_guess summary without changing any stored points
- **Prior art:** the specs above, built with `setupRealStoreGatewayTest`, with timers advanced through the harness's manual schedulers.
- Run with `pnpm --filter backend test <path>` per touched spec, then the full backend suite and `pnpm typecheck`.

## Out of Scope

- The Grading policy and any change to what each grading mode does on each grading event. That is the grading-mode-policy spec.
- Changing which moves grade, the order of the steps, or the reveal gate's condition.
- Changing `gradesChanged` or `regradeForKeyFix`, or merging them into the move entry points.
- Making the ungraded set authoritative from the database outside the reveal gate, or caching it differently.
- Grading in the presenter preview.
- Building the test harness from the Nest module (review candidate 03).

## Further Notes

- **Sequencing with grading-mode-policy:** the two are independent in behaviour but both edit Block grading. Either can land first. If both are in flight, landing grading-mode-policy first is easier, because this spec then moves code that already asks the policy instead of branching on type helpers.
- This is a pure refactor. A spec whose assertions need changing means behaviour drifted, so investigate it rather than updating it.
- Small enough for a single ticket: the interface change, both call sites and the new harness cases, then the glossary line.
- Commit scope is `backend` for code and `repo` for GLOSSARY.
