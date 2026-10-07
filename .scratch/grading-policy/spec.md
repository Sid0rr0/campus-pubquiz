# Spec: Grading policy in one module — key-fix regrades and the Grading refresh behind a narrow interface

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-07, candidate 7 ("Grading policy in one module: regrades and the Grading refresh").

## Problem Statement

How a live answer-key fix rescores answers, and how a grade change reaches the session, is spread over three modules, and the module that should own it has a shallow interface.

- **The Live session module does grading work.** A quiz edit builds a map of every question as it stood before the reload, asks the block grading module to regrade, merges the recomputed closest_guess summaries into the session, runs the Grading refresh, applies it, then lists every regraded question's answers to work out which teams to sync. About 100 lines of the Live session module are grading policy, not session flow.
- **The Grading refresh is two calls that every caller pairs by hand.** The block grading module exposes the step that reads which questions are ungraded, and a separate helper in the session updates module applies it to the session. Five places call one and then the other. Nothing stops a caller from reading the refresh and not applying it, or applying it to a different session from the one it was read for.
- **A change to key-fix behaviour touches five modules.** Which questions need a regrade is decided by the live-edit guard, the quiz controller and the gateway pass it on, the Live session module prepares the "before" questions and the team syncs, the block grading module dispatches by question type, and the answer module holds the per-answer rules (overwrite auto grades, keep the moderator's grade on a non-matching typed answer). The accepted tradeoff in the project guide, "Live answer-key fixes overwrite manual overrides", has no single home.

None of this is broken today. The Grading refresh spec closed the last stale-marker gap. The cost shows when grading rules change, and two specs on the board (question answer kinds and the Live edit module) are about to edit the code around them.

## Solution

The block grading module becomes the one home for grading policy during a live session, behind two calls that each return the new session:

- **"Grades changed for these questions"** takes a session and the question ids whose grades just changed, and returns the session with the Grading refresh already applied. Reading the refresh and applying it become one step, so a caller can't do only half of it.
- **"Regrade for a key fix"** takes the reloaded session and the session as it was before the edit, plus the question ids the edit corrected. It works out the previous questions itself, dispatches by question type, merges the recomputed closest_guess summaries, ends through the Grading refresh, and returns the new session, the questions it actually rescored, and the teams that have an answer to one of them.

The Live session module's quiz edit shrinks to: reload, call "regrade for a key fix", and turn the result into an outcome (answer lists for the rescored questions, team syncs for the connected teams it named). The answer-change path calls "grades changed" in place of the two-call pairing. The read and apply halves of the Grading refresh become internal to the block grading module.

Nothing changes on stage, on the phones, in the socket contract or in the database. A key fix grades exactly as it does today.

## User Stories

1. As a quiz master fixing an auto-graded question's key mid-quiz, I want every answer to it rescored against the corrected key, as today, so that the leaderboard is right.
2. As a quiz master fixing a match question's key, I want any partial credit I adjusted to be overwritten by the rescore, as the project guide describes, so that I re-override in the break if needed.
3. As a quiz master fixing a typed question's key (free_text, audio, YouTube), I want an answer that now matches graded correct, as today.
4. As a quiz master fixing a typed question's key, I want my grade on a non-matching answer kept, as today, so that a key fix doesn't throw away my judgement.
5. As a quiz master fixing a typed question's key, I want an answer that was only graded automatically and no longer matches to go back to ungraded, as today, so that I grade it before advancing.
6. As a quiz master fixing a closest_guess key after the lock, I want the batch re-run against the corrected target and the reveal summary updated, as today.
7. As a quiz master fixing a closest_guess key before the lock, I want nothing regraded, so that the normal lock grades it with the new key, as today.
8. As a quiz master fixing a kahoot question's key, I want the speed scaling re-applied from the stored response times, as today, whether the fix lands before or after the lock.
9. As a quiz master, I want `/control`'s ungraded markers and the showdown eligibility to be right the moment a key fix is saved, as the Grading refresh made them.
10. As a quiz master, I want the admin answer list of every rescored question refreshed after a key fix, as today.
11. As a quiz master, I want an edit that corrects no shown question to only reload and broadcast, as today.
12. As a team, I want my phone to get my rescored answers after a key fix, as today, so that my points and verdict match the leaderboard.
13. As a team that has left or lost connection, I want no sync sent to me after a key fix, as today, and the right answers on my next resync.
14. As a team submitting, revising or having an answer graded, I want the ungraded markers and the leaderboard updated exactly as today.
15. As a quiz master, I want the closest_guess batch at the lock, kahoot speed scoring at the lock, entering the break and restore after a restart to keep the markers right, as today.
16. As a developer changing how a key fix rescores, I want to change one module, so that the rule and its tests sit together.
17. As a developer adding a new way of changing grades, I want one call that returns the updated session, so that I can't forget to apply the Grading refresh or apply it to the wrong session.
18. As a developer reading the Live session module, I want the quiz edit to read as reload, regrade, outcome, so that session flow and grading policy don't interleave.
19. As a developer working on the Live edit module spec, I want the quiz edit step I split out to be short, so that moving it inside the held writes is a small diff.
20. As a developer working on the question answer kinds spec, I want the per-type regrade dispatch in one place, so that routing scoring through answer formats has one caller to update.
21. As a developer writing a key-fix test, I want to drive it through the gateway and assert what `/control` and the phones were sent, so that the test survives any internal reshuffle.

## Implementation Decisions

- **The block grading module's interface for the rest of the backend is two calls, plus what the Commit a move steps already use:**
  - *grades changed:* `(session, questionIds) → session`. It runs the Grading refresh for those questions and returns the session with their ungraded entries replaced. It keeps today's rule that only the current block's questions are refreshed.
  - *regrade for a key fix:* `(reloaded session, session before the edit, questionIds) → { session, regradedQuestionIds, answeringTeamIds }`. The previous questions come from the before-session's seeded game, so the caller stops building that map. It dispatches by type exactly as today, merges recomputed closest_guess summaries into the returned session, and ends through the Grading refresh for the questions it rescored. `answeringTeamIds` holds every team with an answer to a rescored question. Narrowing it to connected teams stays with the Live session module, which owns sockets.
  - The Commit a move steps (closest_guess batch, kahoot speed scoring, the bulk refresh on entering the break and on restore, and the ungraded reader behind the leave-break gate) keep their current shape. They already return a session.
- **The Grading refresh's read and apply halves become private to the block grading module.** The apply helper moves out of the session updates module into it, so there is still exactly one way to write the ungraded set, and it lives next to the reader. The `GradingRefresh` type stops being exported. The bulk refresh keeps replacing the set outright, so nothing from an earlier block survives.
- **Applying inside one call is safe now.** The Grading refresh spec kept "fetch, then apply in one synchronous update" so another event couldn't overwrite the session in between. Every grade change now runs inside the Session write, one at a time per session, so a call that reads and then returns the applied session can't lose a concurrent update.
- **The answer-change path** (submit, grade) calls *grades changed* and puts its answered-team ids on the result. It still lists the question's answers alongside, and its outcome is unchanged.
- **The Live session module's quiz edit** reloads the quiz, calls *regrade for a key fix* with the reloaded and started sessions, and builds the outcome from the result: a plain broadcast when nothing was rescored, otherwise the rescored questions' answer lists and team syncs for the connected teams among `answeringTeamIds`. Its private regrade step goes away.
- **The per-answer rules stay in the answer module**: rescoring an auto-graded question, the moderator-vs-automatic test on typed answers, the closest_guess batch, and kahoot speed scaling. They are database writes over a question's answers, and the answer module's grading spec already pins them. The block grading module decides *which* rule runs for *which* question and what the session does afterwards.
- **Which questions a save corrects** (the live-edit guard's regrade selection) stays with the live edit code. It decides from the drafts, before any session is touched, and the Live edit module spec owns that path.
- **No behaviour, wire, schema or migration change.** Same grades, same outcomes, same order of delivery.
- **Docs, in the same change:**
  - `GLOSSARY.md`: the **Grading refresh** entry already says "the session takes that in a single update". No change, unless the wording ends up implying two steps.
  - `docs/architecture.md`: if a module diagram shows the Live session module calling the answer module for regrades or the session updates helper for grading, point it at the block grading module. The Advance sequence diagram is unaffected.
  - `DOCUMENTATION.md`, `CODING_STANDARDS.md` and the `/guide` page need no change, since no behaviour changes. Check `CODING_STANDARDS.md` for a rule that names the two-call refresh, and update it if there is one.

## Testing Decisions

- **One seam: the real-store gateway harness.** A good test drives a key fix or an answer change through the gateway and asserts what crosses the boundary: the admin answer lists, the team syncs, the leaderboard, the ungraded set in the admin view, and what Advance does. It never asserts which internal call computed them. That's what makes this refactor safe to do without rewriting tests.
- **The existing suites are the regression net and must pass unchanged:** live edit regrade (by question type, including kahoot before and after the lock and closest_guess before and after grading), quiz edited (answer lists, team syncs, leaderboard, no-op edit), the ungraded agreement walk (including its key-fix steps in and out of the set), answer recorded and graded, admin flags, ungraded restore, kahoot scoring, the grading gate, and the answer module's grading spec for the per-answer rules.
- **Gaps to close first, against today's code, so that they pass before and after:**
  - a key fix where a team that answered a corrected question has disconnected: no sync is sent to it, and the connected teams still get theirs. This pins the split between `answeringTeamIds` and the connected-team narrowing.
  - a key fix that corrects two shown questions at once, one auto-graded and one typed: both answer lists are refreshed, each answering team is synced once, and the ungraded set reflects the typed one. This pins the multi-question merge that moves into the block grading module.
  Add them to the quiz edited spec or the live edit regrade spec, whichever already sets up the matching quiz.
- **No new unit spec for the block grading module.** Its two calls are internal to the backend, and testing them in isolation would mean mocking the answer module, which the real-store harness already avoids. The compiler covers the rest: once the refresh helpers are private, a caller that tries to pair them fails typecheck.
- **Prior art:** `quiz-edited.spec.ts` for outcomes after a key fix, `live-edit-regrade.spec.ts` for per-type setups, `ungraded-agreement.spec.ts`'s `fixAnswerKey` helper and its `step` assertion, and the real-store gateway test utils for disconnecting a team.

## Out of Scope

- Changing what a key fix does to grades. The accepted tradeoff in the project guide stands.
- Moving the per-answer regrade rules into Scoring as pure functions. That fits better once question answer kinds has routed scoring through answer formats.
- Moving the regrade selection out of the live-edit guard, or the check, save and reload under the Session write. That is the Live edit module spec (review candidate 3).
- Separating block membership from the reveal views (review candidate 6). The Grading refresh keeps reading the current block through today's block helper.
- Grading attribution (`gradedBy`). Accepted tradeoff.
- Any change to the submit-time revision rules in the answer module.

## Further Notes

- **Overlap with live-edit-save ticket 03**, which splits the quiz edit into a step that takes a session and returns the reloaded and regraded session plus its outcome. The two changes touch the same method but don't conflict in intent. This one shrinks the step's body, and that one moves where it runs. Whichever lands second rebases. Neither blocks the other.
- **Overlap with question-answer-kinds ticket 01**, which routes scoring through answer formats. The answer module's regrade functions call Scoring, and nothing in this spec changes those calls.
- The review counted the refresh pairing at five call sites. Three of them (the closest_guess batch, kahoot speed scoring and the bulk refresh) are already inside the block grading module, so making the pair private there costs nothing. The two outside it, the answer change and the key fix, are the ones this spec removes.
