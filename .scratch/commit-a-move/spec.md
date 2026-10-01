# Spec: Commit a move — one module from the Move plan to saved progress

Status: ready-for-agent

Blocked by: `.scratch/grading-refresh/` (candidate 1). It rewrites the grading stages this module calls and the break-entry refresh in the same action path. This spec builds on it rather than racing it.

Source: architecture review of 2 Oct 2026, candidate 2 ("Commit a move").

## Problem Statement

The rules for what one press of Advance, Previous or any other admin action does to a live session are spread over four places in the Live session module, and they don't all agree:

- **The Move plan** decides what an ADVANCE or PREVIOUS press does (leaderboard rank, hide the board, showdown step, closest_guess sub-step, status transition, blocked). Other actions skip the plan and call the state machine directly from the action handler.
- **An inline ungraded-answers gate** in the action handler refuses ADVANCE out of the break into reveal while a block question still has an ungraded answer. The Move plan doesn't know about it. The plan, and so the Advance slot and the /remote presenter preview, announce a normal advance into the reveal, and the press is then refused.
- **The lobby start** is a special case written into the presenter preview: in the lobby it predicts START_QUIZ, not ADVANCE. The Move plan doesn't know about that either.
- **A post-settle patch** in the action handler puts the closest_guess reveal sub-step back after the Settle step has reset it, because the Settle step only sees the action, not the kind of step. (A leaderboard rank reveal or hide must leave a closest_guess reveal where it was.)

What a press does is written out inline: plan → switch on step kind → gate → kahoot speed scoring → block grading → ungraded refresh → settle → patch → store → save. Session creation and restart restore each put together their own shorter version of the same pipeline.

The presenter preview doesn't run any of this. It predicts the next screen by projecting the current session with only the new progress swapped in, without grading or settling. So:

- during the break with ungraded answers, /remote's "next" line shows the reveal's round title card when the press will actually be refused;
- anything the Settle step derives (closest_guess reveal sub-step, leaderboard reveal count, timers) is stale in the preview, so the preview and the real screen can differ;
- the existing preview agreement walk only compares headings on a plain quiz, so none of this is caught.

For the quiz master this means /remote sometimes predicts a screen that never appears. For a developer it means "what does a press do" has no single home: a new step kind or a new pre-move check has to be added in several places, and missing one goes unnoticed.

## Solution

Every admin action goes through one Commit-a-move module with a small interface:

- **commit** a press: plan it, refuse it if the plan says so, run the grading it implies, take the Settle step (which now knows the step kind), save the progress, and return the new session together with what has to be delivered;
- **preview** a press: the same plan and Settle step as a dry run, with no grading writes and nothing saved, which the presenter preview uses to describe the next screen;
- **place** a session at a starting point (creation and restart restore) through the same grading refresh and Settle step.

The ungraded-answers gate and the lobby start move into the Move plan, so the plan is the one answer to "what does this press do", and the Advance slot, the presenter preview and the commit all read it.

What the quiz master sees:

- /remote's "next" line always describes the screen the next press actually puts on air. During the break with ungraded answers it says the press is waiting for grading (the same way it already says "Waiting for every guess" for a showdown), not the reveal.
- Everything else on stage behaves exactly as today: same transitions, same refusals with the same messages, same timers, same leaderboard and closest_guess behaviour.

## User Stories

1. As a quiz master on /remote, I want the "next" line to describe exactly the screen my next Advance puts on the big screen, so that I can talk over the transition with confidence.
2. As a quiz master on /remote during the break, I want the "next" line to say Advance is waiting for grading while answers are still ungraded, so that I don't announce the reveal and then get refused.
3. As a quiz master on /remote during the break, I want the "next" line to switch to the reveal's round title card as soon as the last ungraded answer is graded, so that I know I can move on.
4. As a quiz master on /remote during the break, I want a live answer-key fix that leaves an answer ungraded (or clears the last one) to update the "next" line straight away, so that the preview follows the key fix as /control's ungraded markers do.
5. As a quiz master on /control, I want Advance out of the break to keep being refused with the list of ungraded questions while any remain, so that no team's score is revealed before it's final.
6. As a quiz master on /control, I want that refusal to keep coming from a fresh database read, so that even an out-of-date cached ungraded set can never let the reveal start early.
7. As a quiz master on /remote in the lobby, I want the "next" line to keep predicting the rules screen that starting the quiz shows, so that the lobby preview is unchanged.
8. As a quiz master on /control in the lobby, I want the Start button and the Advance slot to behave exactly as today, so that starting the quiz is unchanged.
9. As a quiz master revealing a closest_guess question, I want showing a leaderboard rank or hiding the board to leave the closest_guess reveal on the sub-step it was on, so that the reveal picks up where it left off.
10. As a quiz master on /remote while the leaderboard is up, I want the "next" line to name the next place being revealed, then the screen under the board once every rank is shown, so that the preview follows the board the way the press does.
11. As a quiz master on /remote mid-way through a closest_guess reveal, I want the "next" line to describe the next sub-step, so that I know which guesses come up next.
12. As a quiz master on /remote moving into a closest_guess question's reveal, I want the "next" line to describe the reveal as it will really open (its first sub-step), not as the previous question left it.
13. As a quiz master on /remote in a kahoot round, I want the "next" line to predict the between-questions board and the round-end board (with its top-5 cutoff) exactly as they appear, so that kahoot rounds preview correctly.
14. As a quiz master running a showdown after the quiz ends, I want the "next" line and the press to agree on every reveal step, including "Waiting for every guess", so that the tiebreaker runs smoothly.
15. As a quiz master, I want the final showdown reveal step to keep recording the winner and refreshing the leaderboard, so that the result is saved.
16. As a quiz master, I want Previous to behave exactly as today at every point, so that undoing a press is unchanged.
17. As a quiz master, I want a press whose progress can't be saved to be refused with nothing moving, so that what's on screen never gets ahead of what a restart would restore.
18. As a quiz master, I want a timer-driven lock (the auto-lock deadline or the kahoot question timer) to go through exactly the same commit as my own Advance press, so that a timed lock and a manual lock behave the same.
19. As a quiz master, I want turning the leaderboard on to keep showing every joined team, zero points included, so that the board is complete.
20. As a team on a phone, I want my answers re-synced when the reveal starts, as today, so that my phone shows my graded answers alongside the reveal.
21. As a quiz master, I want kahoot speed scoring to keep running when a kahoot question leaves its locking countdown, so that faster answers keep scoring more.
22. As a quiz master, I want closest_guess questions to keep being batch-graded when the block reaches a graded status, so that their points are on the board at the break.
23. As a quiz master, I want the ungraded markers on /control to stay right when the block enters the break, so that I can see what's left to grade.
24. As a quiz master who restarts the backend mid-quiz, I want the session restored to exactly the same point, with phase timers and the ungraded set rebuilt, so that a redeploy doesn't change the night.
25. As a quiz master who creates a new session, I want it to start in the lobby with its timers and counters settled, as today.
26. As a big-screen audience member, I want the screen after every press to be exactly what it is today, so that the refactor is invisible on stage.
27. As a developer adding a new kind of Move plan step, I want to add it in the plan and the commit module only, so that the Advance slot, the preview and the commit can't disagree about it.
28. As a developer adding a new check before a move (like the grading gate), I want to express it as a Move plan step, so that the preview and the Advance slot know about it automatically.
29. As a developer, I want the Settle step to receive the kind of step it is settling, so that "a leaderboard step leaves the quiz underneath untouched" is decided inside the Settle step, not patched afterwards.
30. As a developer, I want the action handler to be one call into the commit module, so that reading what a press does means reading one module.
31. As a developer, I want session creation and restart restore to settle through the same module as a press, so that the three ways a session reaches a point can't drift apart.
32. As a developer, I want one walk test that checks, at every point of whole quizzes, that the previewed screen is the screen the press then shows, so that any future disagreement fails CI rather than surfacing on stage.

## Implementation Decisions

### The Move plan covers every action

- The Move plan plans any admin action, not just ADVANCE and PREVIOUS. Actions other than ADVANCE/PREVIOUS become a plain transition (or blocked) step through the state machine, the same as the handler does today, so the commit module never branches on the action outside the plan.
- **The ungraded-answers gate becomes a Move plan step.** A new step kind (e.g. "grading pending") is planned for ADVANCE out of a break status into reveal_intro while the session's ungraded set for the block is not empty. It carries the ungraded question ids. Like "showdown waiting", it counts as pressable (the Advance slot still shows Advance) and pressing it answers with the existing ungraded-answers refusal and its question ids.
- The plan stays pure and synchronous, so it reads the session's cached ungraded set. Once grading-refresh has landed, every grade change keeps that set fresh, so the plan, the Advance slot and the preview are exact. The commit module still re-reads the database before committing a break → reveal_intro transition, as the inline gate does today, and refuses if anything is ungraded. The project rule that the leave-break gate never trusts the cache stays.
- **The lobby start becomes part of the Move plan.** The Move plan module owns "the next press": START_QUIZ in the lobby (when the leaderboard isn't up), ADVANCE everywhere else. The presenter preview asks the plan for it and no longer has its own lobby special case. The Advance slot's announcement in the lobby is unchanged.
- The "effective action" rule (a leaderboard hide is carried out as TOGGLE_LEADERBOARD) stays in the Move plan module.

### The Settle step knows the step kind

- The Settle step's input gains the kind of step being settled (or "place" for creation/restore, standing in for today's null action).
- For the leaderboard reveal and hide steps, the Settle step leaves the closest_guess reveal sub-step as it was. The post-settle patch in the action handler is deleted.
- Everything else the Settle step derives (phase timer, auto-lock and kahoot deadlines, break end time, leaderboard reveal count, initial closest_guess sub-step) is unchanged.

### The Commit-a-move module

A deep module behind the Live session module, with three entry points:

- **commit(session, action)** → the committed session plus its delivery outcome, or a refusal.
  - Plans the press. Blocked, showdown-waiting and grading-pending steps are refused, keeping today's error types and messages (the gateway turns them into the acknowledgement message exactly as now).
  - Ephemeral steps (showdown reveal step, closest_guess sub-step) are committed without touching game progress and without saving, as today. The final showdown step still resolves the round and refreshes the leaderboard.
  - Progress-moving steps (transition, leaderboard reveal, leaderboard hide) run, in order: the database ungraded check for break → reveal_intro; the grading stages (kahoot speed scoring, closest_guess block grading, the break-entry bulk refresh, each ending through grading-refresh's grading refresh); the Settle step with the step kind; saving progress and the phase timer.
  - The follow-ups `applyAdminAction` adds today move into the commit: fetching a fresh leaderboard when TOGGLE_LEADERBOARD turns the board on, and naming every connected team for an answer re-sync on reveal entry. The commit returns them in the outcome. This removes the second in-memory write after an await that the action path does today.
  - **Save before store.** The new session goes into the in-memory session store only after its progress is saved. If saving fails, the press is refused and the session is left where it was. (Today memory moves first and a failed save leaves the two apart.) Grading writes made before the failed save are idempotent and are redone by the next press.
- **preview(session, action)** → the session as it would stand after the press, or the planned step when it moves nothing. This is the same plan and the same Settle step with no grading writes, no showdown resolve and nothing saved. The presenter preview describes the screen by projecting this previewed session, not the current session with only the progress swapped in. Steps that don't move the screen (grading pending, showdown waiting, blocked) are described from the step, as today's showdown-waiting text is. The grading-pending text says Advance is waiting for grading.
- **place(session, progress, savedPhaseTimer?)** → the session settled at a starting point. It runs the bulk ungraded refresh (gated on the break statuses, as today) and the Settle step. Creation (lobby, no saved timer) and restart restore (saved progress and timer) both call it in place of their hand-built pipelines. Nothing is saved.

### What stays where

- The Live session module's public interface doesn't change: `applyAdminAction`, `getPresenterContext`, `getView`, `getSnapshot`, `createSession`, startup restore. `applyAdminAction` becomes a delegation to commit plus storing the result. `applyAction`'s body is replaced by the same delegation. Making it private is left to the "team events into the Live session module" candidate.
- The grading stages stay in the block grading module. The commit module calls them in the order above.
- Admin view announcements (Advance slot, Previous state) keep reading the Move plan. With the gate in the plan they need no change.
- No socket protocol, shared type, schema or migration changes are expected beyond the preview's new "waiting for grading" text, which is an existing `ScreenPreview` heading/body.

## Testing Decisions

- **One seam:** the Live session module's existing interface, driven through the real-store gateway harness (Postgres). Tests press actions with `act`, then read the admin/display/players views, the presenter context and the saved progress. The commit module has no direct tests. Its behaviour is only seen through the views and the saved progress.
- **Good tests check external behaviour:** what's on air after a press, what /remote said it would be, what the acknowledgement says when a press is refused, and what a restart restores. They don't check which internal step ran or in what order.
- **New preview-vs-commit agreement walk.** At every point of whole-quiz walks, before each press, take the presenter preview's "next" screen. Press. Check the screen now on air matches it (heading and the on-air screen kind and key, not just the heading). A press that moves nothing must have been previewed as moving nothing, or as "waiting". Walks cover:
  - a two-block quiz through break, reveal and the end-of-block leaderboard;
  - a break with an ungraded match-or-human answer: the preview says waiting for grading, the press is refused, and after the moderator grades it the preview names the reveal's round title card and the press shows it;
  - a break where a live answer-key fix makes an answer ungraded, then grading it: the preview follows both changes;
  - a closest_guess reveal with its sub-steps, including showing and hiding the leaderboard mid-reveal and moving into a closest_guess reveal from an earlier question;
  - a kahoot round's between-questions board and round-end board with the top-5 cutoff;
  - a leaderboard tie;
  - an ended quiz with an active showdown, including "waiting for every guess" and the final resolving step;
  - the lobby start.
- **First, pin today's behaviour.** Before any production change, write the walk against the current code and pin today's disagreements (ungraded break preview; any closest_guess preview mismatch) as named exceptions. Then the refactor removes the exceptions. Same approach as the advance-plan agreement walk.
- **Regression coverage that must stay green unchanged:** the grading gate spec, the action-availability agreement walks, the presenter context spec, the closest_guess reveal, showdown reveal, leaderboard and advance-under-leaderboard specs, the kahoot timer and question-lock auto-advance specs, the ungraded restore and agreement specs, and the persistence and session-creation specs.
- **Save-before-store:** cover it through the harness by making the progress save fail for one press (the real-store harness can swap the progress repository's save). Assert the press is refused and the next snapshot is unchanged.
- **Prior art:** the advance-plan agreement walk in the action-availability spec (press-and-compare helpers, named exceptions), the presenter context spec's "agreement with /display across a whole-quiz walk", the grading gate spec (ungraded answer setup and grading), and the ungraded-agreement spec's `fixAnswerKey` helper.

## Out of Scope

- Keeping the ungraded set fresh after every grade change, the live answer-key fix included. That is grading-refresh (candidate 1), which this spec is blocked by.
- Serialising each session's async writes, and the standings refresh for score changes that don't come from grading (review candidate 5).
- Moving team events into the Live session module and removing its getters, including making `applyAction` private (review candidate 4).
- The players view reveal leak and the named phone screen (review candidate 3).
- Folding the shallow state utils and the import reload path (review candidate 6).
- Any change to the state machine's transitions, to what the Advance slot or Previous state announce, or to /control and /display rendering.

## Further Notes

- This builds on the advance-plan and session-settle work: it finishes "one Move plan drives the handler, button availability and the /remote preview" by also bringing in the gate and the lobby, and "every way a session reaches a new point goes through the Settle step" by making the Settle step aware of the step kind.
- grading-refresh lists "putting the leave-break gate into the Move plan" as out of scope and hands it to this candidate. This spec picks it up.
- CONTEXT.md: extend **Move plan** to mention the grading-pending step and the lobby start, and add **Commit a move** (carrying out one planned press: grade, settle, save), with "apply action" listed under _Avoid_.
- DOCUMENTATION.md: if it describes the break → reveal gate or the presenter preview, note that the preview now says Advance is waiting for grading. The `/guide` page's /remote section should mention the same line if it describes the "next" preview.
