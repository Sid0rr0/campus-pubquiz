# Spec: Every change to grades ends through one grading refresh

Status: ready-for-agent

Blocked by: — (follows ungraded-source and typed-answer-grading, both done)

## Problem Statement

During a break the quiz master works through `/control`'s ungraded markers until none are left, then advances to the reveal. On the last block, the showdown option is offered only once nothing is ungraded. Both read the session's ungraded set, a copy of "which questions in this block still have an answer waiting for the quiz master" that the Live session module keeps in memory and sends in the admin view.

Grades change in six ways, and each one is responsible for remembering to refresh that copy:

- **Answer submitted or graded.** It refreshes the ungraded flag for that one question, plus the leaderboard.
- **Break entered.** The block's set is read again in bulk.
- **Restore after a restart.** Same bulk read.
- **closest_guess batch and kahoot speed scoring.** They don't need to refresh it, because neither can leave anything ungraded. They refresh the leaderboard through their own step.
- **Live answer-key fix.** It refreshes **only the leaderboard**, so the ungraded set goes stale.

That gap is visible on stage. Since typed-answer grading, a key fix re-grades typed answers (free_text, audio, YouTube) against the corrected key:

- **A previously matching answer that no longer matches** has its automatic grade cleared and goes back to waiting for the quiz master. `/control` doesn't show the marker, and on the last block the showdown is offered over an ungraded answer. The quiz master only finds out when Advance is refused.
- **A waiting answer that now matches** is graded correct. `/control` keeps showing the marker until some other event happens to refresh that question.

The ungraded agreement walk only fixes keys on questions that are already in the set, so it never sees this. More generally, every new way of changing grades has to remember the refresh, and nothing makes it.

## Solution

**One grading refresh.** The block grading module gets one step that brings the session into line after grades changed for a given set of questions:

- it re-reads which of them are ungraded (through the existing ungraded reader)
- it fetches fresh standings
- it returns both to apply to the session in one go

Every way grades change ends through it:

- answer submitted or graded: that question
- live answer-key fix: the questions it re-graded
- break entered and restore: the whole block, as a bulk refresh
- closest_guess batch and kahoot speed scoring: the questions they scored, which can never be ungraded, so only the standings move

Because the key fix now ends through the same step as everything else, `/control`'s markers and showdown eligibility are right the moment the corrected key is saved. Nothing else changes: not on stage, not on the phones, not in the socket contract.

## User Stories

1. As a quiz master fixing a typed answer's key during a break, I want an answer that no longer matches to show as ungraded on `/control` straight away, so that I grade it before advancing.
2. As a quiz master fixing a typed answer's key during a break, I want a question whose waiting answers all now match to lose its ungraded marker straight away, so that I don't hunt for work that is already done.
3. As a quiz master fixing a key on the last block, I want the showdown option to disappear when the fix leaves an answer ungraded, and come back when I grade it.
4. As a quiz master fixing a key while the question is still open for answering, I want the ungraded marker for that question to be right when the break starts and in the meantime.
5. As a quiz master fixing an auto-graded (multiple choice, sort, match) key, I want the ungraded markers unchanged, since those questions never wait for me, as today.
6. As a quiz master fixing a closest_guess key, I want it never to show as ungraded, as today.
7. As a quiz master, I want the leaderboard after a key fix to be as fresh as today.
8. As a quiz master, I want a team submitting, revising or having an answer graded to update the marker and the leaderboard exactly as today.
9. As a quiz master, I want entering the break to show the block's ungraded markers, and Advance out of the break to be refused with the list of ungraded questions until they're graded, as today.
10. As a quiz master whose backend restarts mid-break, I want the markers to be right straight away, as today.
11. As a quiz master running a kahoot round, I want speed-scored points and the leaderboard as fresh as today after the lock.
12. As a quiz master, I want a key fix to keep overwriting manual overrides on auto-graded questions and keep the moderator's grade on a non-matching typed answer, as the project guide describes. Only the markers change.
13. As a team, I want my phone's points and verdict after a key fix to be as they are today.
14. As a developer adding a new way of changing grades, I want one step to end through, so that the ungraded set and the leaderboard can't be forgotten.
15. As a developer, I want the agreement walk to cover key fixes that move a question in and out of the ungraded set, so that this gap can't reopen.

## Implementation Decisions

- **The grading refresh lives in the block grading module.** Its interface is: given the session and the question ids whose grades just changed, return the change to apply, made up of which of those questions are ungraded (via the existing ungraded reader, so closest_guess is still dropped) and fresh standings. The caller applies it in one synchronous update.
- **Applying the change.** The given questions' ungraded entries are replaced (added when ungraded, removed otherwise) and the leaderboard is replaced. The bulk refresh is the same thing with the whole block as the given questions.
- **Fetch, then apply.** Writers that today fetch and then apply in one synchronous update (answer change) keep that shape. The refresh must not become a read-modify-write of the session across an `await`. The reason is the same as in ungraded-source: another event could update the session in between and be overwritten.
- **The key fix ends through the refresh** for the questions it re-graded, inside the Live session module's handling of a quiz edit. The re-grade itself (which answers are re-scored, which manual grades survive) is unchanged.
- **Every key fix that re-scores a question refreshes it,** whatever the game status. This includes the open-question case: outside the break the set is kept per question by the answer-change path, so a key fix must keep it per question too.
- **The internal standings step goes away.** The grading stages' own "fetch standings, put them on the session" step is replaced by the refresh. closest_guess batch and kahoot speed scoring pass the questions they scored. Those can never be ungraded, so only the standings move.
- **Break entry and restore** use the refresh as the bulk refresh, gated on the break statuses exactly as today.
- **The leave-break gate still reads the database directly** through the ungraded reader. It must not trust the cached set.
- **The per-question patch helper** in the session updates module is replaced by the change the refresh returns, or becomes its implementation. There should be one way to write the ungraded set.
- **Unchanged:** the answer-change path's other work (the question's answered-team ids, the admin's answer list), the outcome's answer list and team-sync set after a key fix, and the socket contract.
- **Out of the refresh's job:** standings updates that don't come from grading (team connected or removed, bonus changed, showdown resolved). They stay where they are; see Out of Scope.
- **Domain language.** Add **Ungraded** to `CONTEXT.md`: an answer still waiting for the quiz master, and a question with such an answer. ungraded-source planned this and it hasn't been done. Add **Grading refresh** next to **Settle step**, since both name "the one step every path goes through".

## Testing Decisions

- **One seam: the real-store gateway harness.** A good test drives events through the gateway and asserts what `/control` was sent and what Advance does. It never asserts which internal step computed the set.
- **Extend the ungraded agreement walk.** Each new step asserts the admin view's ungraded set equals a fresh database read and the expected ids:
  - in the break, a key fix on a typed question whose only answers were auto-matched, making one no longer match: the question appears
  - in the break, a key fix that makes a question's only waiting answer match: the question disappears
  - a key fix on a typed question while it is still open for answering (before the break), in both directions
  - a key fix on the last block that leaves an answer ungraded: showdown eligibility is false until it's graded. This may live in the admin-flags spec if that is where showdown eligibility is pinned today.
  - the existing key-fix steps stay, so the cases where the set doesn't change remain covered
- **Write the new steps first, against today's code.** The break-time key-fix steps must fail before the change; that failure is the bug.
- **Existing specs pass unchanged:** the grading gate, grading, answer recorded and graded, admin flags projection, ungraded restore, live edit regrade, leaderboard, kahoot scoring, and the `/control` grading browsing tests. They pin everything this feature must not change.
- **Prior art:** the ungraded agreement walk's `fixAnswerKey` helper and its `step` assertion; the live edit regrade spec for setting up a key fix mid-break.

## Out of Scope

- **Moving the grading writes themselves** (submit, grade) behind the Live session module, with handlers calling one method. That is architecture-review candidate 4 (team events into the Live session module); it builds on this but isn't needed for the fix.
- **One standings step for every score change** (team connected or removed, bonus, showdown). That is candidate 5; it needs a per-session write step that serialises async changes, which is a bigger decision.
- **Putting the leave-break gate into the Move plan.** That is candidate 2 (commit a move).
- **Changing what a key fix does to grades.** The accepted tradeoff in the project guide stands.
- **Grading attribution (`gradedBy`).** Accepted tradeoff.

## Further Notes

- This was candidate 1 of the 2 October 2026 architecture review. It is the item ungraded-source left out as "best done after session-settle", cut to the refresh only. The grading writes stay where they are.
- **How the gap opened.** When ungraded-source was written, a key fix couldn't move an answer in or out of ungraded: audio and YouTube were skipped by key fixes, and free_text was always auto-graded. typed-answer-grading made a key fix able to clear or set a typed answer's grade, but the key-fix path still refreshed only the leaderboard. The agreement walk's key-fix steps were kept, but they all target a question already in the set.
- The bug was confirmed by reading the code: the regrade of typed answers clears or sets grading times, and the key-fix path refreshes only the leaderboard and closest_guess summaries. The new agreement-walk steps are what prove it.
- Docs: `DOCUMENTATION.md` needs no change, since behaviour matches what it already describes. If the `/guide` page says markers update after a key fix, it is now true. Check it, and leave it alone if it says nothing.
