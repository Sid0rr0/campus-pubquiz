# Spec: One settle step derives a session's fields; named status groups

Status: ready-for-agent

Blocked by: advance-plan ticket 02 ("One Move plan drives the handler, button availability and the /remote preview"). That ticket rewrites the same action handler. This spec builds on it rather than racing it.

## Problem Statement

A live session holds its game progress plus a handful of fields that must always agree with that progress:

- the phase timer (which timed phase is live, when it started, elapsed time per phase)
- the auto-lock deadline for a break point's last question
- the kahoot question deadline
- the break end time
- how many leaderboard ranks are revealed
- which closest_guess reveal sub-step is showing

None of these is owned by one module. Each is computed by its own small pure function, and three places assemble them by hand:

- **Advance/Previous in the Live session module.** After grading, it computes:
  - the phase timer from five positional arguments
  - the auto-lock deadline
  - the kahoot deadline, which must run _after_ the phase timer because it reads the timer's output
  - the break end time, as an inline rule
  - the leaderboard reveal count, from six positional arguments
  - the closest*guess starting step, which must run \_after* grading because it reads the batch-grading summaries

  The order matters and nothing enforces it.

- **Creating a session.** The fresh-session builder computes the phase timer, both deadlines and the defaults again, its own way.
- **Restoring sessions after a restart.** This path starts from the fresh-session builder, then overwrites the phase timer with the saved one. It then has to recompute the kahoot deadline by hand, because the builder had computed it from a throwaway placeholder. A comment explains that skipping that step would arm the wrong deadline after a restart mid-kahoot-question.

The bugs live in how the pieces are stitched together, not in the pieces. Every new derived field, or every change to when one resets, has to be threaded into all three places in the right order. The restore fix is exactly that kind of bug, caught once.

Separately, the game's statuses are grouped by meaning in about a dozen places across the three workspaces, each written as an inline list or a chain of comparisons. The groups are: "teams can answer", "a question is on air", "the block is being graded", "grading can be trusted", "answers are being revealed" and "the phone is reviewing the block". The groups overlap, the copies differ subtly, and adding a status means finding every list. Examples:

- the backend's answering check includes round_intro, but the "current question is populated" check doesn't
- the phone's review list is written out separately from the backend's grading list

## Solution

**One settle step owns every progress-dependent field.** Given a session and the progress it is moving to, plus the action and the time, it returns the session with every derived field consistent with that progress. It is pure, takes one named input object, and its internal order is fixed. The three places that assemble fields today all go through it:

- **Advance/Previous:** grading runs first, as today; then one settle call.
- **Creating a session:** settle from the lobby.
- **Restoring after a restart:** settle the saved progress with the saved phase timer, in one call. The by-hand kahoot deadline recompute disappears.

**Named status groups live in shared types next to the state machine**, each the single definition of what it means. Every inline status list in the backend and frontend reads a named group instead.

Nothing changes on stage, on the phones, or in the socket contract.

## User Stories

1. As a quiz master, I want the auto-lock countdown on a break point's last question to start, reset and expire exactly as it does today, so that the change is invisible on stage.
2. As a quiz master running a kahoot round, I want each question's timer to start the moment the question is shown (when the between-questions leaderboard is hidden) and auto-lock on expiry, as today, so that every team gets the full answering time.
3. As a quiz master, I want the phase timer on /control to keep counting each phase's elapsed time across Previous and Advance, as today, so that I can pace the evening.
4. As a quiz master, I want a break end time I set in advance on the block's last question to survive into the break, and a stale one from an earlier break to be cleared, as today, so that the big screen never shows a past time.
5. As a quiz master, I want the leaderboard to start from nothing revealed every time it is newly shown (toggle, end of a block, end of the quiz), as today, so that a reveal never inherits a stale count.
6. As a quiz master running a kahoot round, I want the between-questions leaderboard to show its top 5 at once, as today.
7. As a quiz master revealing a closest_guess question, I want its reveal to start on the right sub-step when I arrive on it, forward or backward, as today.
8. As a quiz master whose backend restarts mid-countdown, I want the auto-lock to still fire, as it does today, so that a redeploy doesn't stall the quiz.
9. As a quiz master whose backend restarts mid-kahoot-question, I want the question's deadline restored exactly from the saved phase timer, so that teams neither lose nor gain answering time.
10. As a quiz master whose backend restarts, I want the phase timer's elapsed times restored exactly, downtime included, as today.
11. As a quiz master creating a new session, I want it to start in the lobby with no deadlines, no break end time and an empty reveal, as today.
12. As a team, I want to be able to answer in exactly the same statuses as today, including stepping back into a round intro whose questions are already open, so that nothing about answering moves.
13. As a team, I want my phone's break and reveal review screens to appear in exactly the same statuses as today.
14. As an audience member, I want the big screen's answer-count and live-question screens to appear in exactly the same statuses as today.
15. As a quiz master, I want /control's answer status panel to show in exactly the same statuses as today.
16. As a developer, I want every progress-dependent session field derived in one step with a fixed internal order, so that adding a field or changing when one resets is a single edit with no ordering trap.
17. As a developer, I want session creation, restore and Advance/Previous to share that step, so that a field can never be computed one way on a fresh session and another way after a restart.
18. As a developer, I want the settle step to take one named input instead of long positional argument lists, so that I can't swap two timestamps by accident.
19. As a developer, I want each meaningful group of statuses defined once in shared types, so that adding or changing a status means updating one definition that the compiler and a table test check.
20. As a developer, I want the frontend and backend to read the same status groups, so that "a question is on air" means the same thing on /display, /control and the server.
21. As a developer, I want a table test that states which status belongs to which group, so that any change to a group shows up as one explicit, reviewable diff.

## Implementation Decisions

- **New module: the settle step,** inside the Live session module, pure.
  - **Input:** one named object holding the session as it stands (graded already, when grading applies), the progress it is moving to, the action that caused the move (or none for create and restore), the current time, and, for restore only, the saved phase timer to resume.
  - **Output:** the session with every progress-dependent field set. Those fields are:
    - the phase timer fields
    - the auto-lock deadline
    - the kahoot question deadline
    - the break end time
    - the leaderboard reveal count
    - the closest_guess reveal step
    - the progress itself
  - The rules for each field are carried over unchanged from today's helpers, which become the settle step's internals. The fixed internal order is: phase timer, then the deadlines that read it, then break end time, reveal count and closest_guess step.
- **Restore semantics are preserved exactly.**
  - A saved phase timer resumes exactly, downtime included.
  - The auto-lock deadline re-arms fresh from the restore time, as today's deliberate restart tradeoff.
  - The kahoot deadline is computed from the resumed phase timer in the same settle call, so no recompute step is needed.
- **Create uses the same step:** settle from the lobby with no action, giving the same defaults as today.
- **Advance/Previous:** after the Move plan picks a state-machine transition, the handler runs grading as today, then calls settle once, then persists.
  - Grading means the ungraded gate, kahoot speed scoring, block batch grading and the ungraded refresh.
  - Showdown and closest_guess sub-steps don't change progress and don't call settle, apart from the closest_guess step field they already own.
- **The fresh-session builder** keeps only the progress-independent defaults (teams, empty caches, display text scale) and delegates every derived field to settle. The restore path's hand-written kahoot recompute is deleted.
- **Timers:** the gateway keeps arming timers from the session's deadlines at its existing points (startup, after an admin action, after a timer fires). Settle only guarantees the deadlines are right.
- **Status groups in shared types,** next to the state machine. Each is a named, read-only set of statuses with a matching predicate:
  - **answering:** question_open, locking, round_intro
  - **question on air:** question_open, locking
  - **grading:** break_intro, break, break_round_intro
  - **graded:** grading plus reveal_intro, reveal, ended
  - **revealing:** reveal_intro, reveal
  - **block review:** grading plus revealing (the phone's break and reveal screens)
  - **block started:** answering plus graded, i.e. every status where a block's questions exist for the session
- **Group membership is carried over from today's lists exactly.** Where two copies of "the same" group differ today, each call site keeps its current behaviour by reading the group that matches what it did. The table test makes those differences explicit instead of hidden.
- **Every inline status list is replaced** in the backend, the frontend and shared types. That covers the backend's answering check, grading and graded lists, the block-question visibility checks, the timed-phase check, /display's live-question check, /control's answer-status check, and /play's review check. The backend's own grading and graded constants and its answering helper are deleted in favour of the shared groups.

## Testing Decisions

- **A good test drives the game and observes outcomes.** It asserts on deadlines in the views, timers firing, elapsed phase times, reveal counts and screens. It never asserts on which helper ran or in what order. The settle step stays internal with no tests of its own, so it can be reshaped freely.
- **Seam 1: the real-store gateway harness.** Existing specs pin behaviour today and must pass unchanged:
  - phase timer lifecycle
  - question lock countdown, auto-advance and timer isolation
  - kahoot question timer and auto-advance
  - break end time
  - leaderboard and its reveal
  - closest_guess reveal
  - persistence and quiz selection
  - session lifecycle
- **New harness cases:**
  - restart mid-kahoot-question restores the exact remaining deadline from the saved phase timer and auto-locks on time
  - restart mid-phase restores elapsed times exactly
  - a freshly created session has no deadlines, no break end time and an empty reveal

  Prior art: the harness's restart helper and fake clock, the existing "still auto-advances to break after a backend restart mid-countdown" case, and the kahoot question timer spec.

- **Seam 2: a table test on the shared status groups.** It lists every status and states its membership in each group. Adding a status fails the test until its memberships are decided. This sits beside the existing shared state machine tests. The groups are a public, shared interface, so a table at their own seam is the natural test.
- **Frontend:** existing /display, /control and /play tests that cover the live-question screen, the answer status panel and the phone's review screens pass unchanged. No new frontend seam is needed.

## Out of Scope

- **Choosing which step a press takes.** That is the Move plan, in advance-plan.
- **When grading runs and when a score is final** (the ungraded gate, kahoot speed scoring, block batch grading, the ungraded caches). That is the separate Block grading candidate. This spec calls grading exactly as today.
- **Timer arming as a returned effect.** The startup re-arm fix closed the restore gap. The gateway's three arming points stay as they are.
- **Replacing the session's one-line update helpers** (the with-field setters). Inlining them would move code without concentrating it.
- **Any change to on-stage behaviour, phone behaviour, the socket contract or persistence format.**
- **Per-question-type knowledge.** That is the Question kind module, in question-kind-module.

## Further Notes

- The restart, deactivation and live-edit bugs found in the same architecture review have already been fixed and are not part of this spec.
- "Settle step" and the status group names (answering, question on air, grading, graded, revealing, block review, block started) are domain terms. Add them to CONTEXT.md alongside the Move plan when this lands.
