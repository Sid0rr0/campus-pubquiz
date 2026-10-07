# Spec: Deleting a middle question from a round saves

Status: done

Blocked by: — (follows live-edit-save, done)

## Problem Statement

Saving a quiz whose draft drops a question from the middle of a round (for example Q1, Q2, Q3 saved as Q1, Q3) fails with a Postgres unique-constraint error, `questions_round_id_order_index_unique`, and surfaces as a 500. It reproduces with no live session, through `QuizService.update`.

Cause (found while building live-edit-save): `QuizService.syncRoundsAndQuestions` calls `parkIdKeyedQuestions`, which moves only the questions the draft keeps out of the way. The dropped question's row is deleted at the end, after the survivors have been upserted into its slot. In the example, Q3 is upserted to `orderIndex` 1 while Q2 still holds it.

This also forced the live-edit-save reverse-order race test to reword a question's prompt instead of deleting the next question, so the "save deletes the next unopened question, then the Advance opens the one that follows" case is not covered.

## Solution

A save that drops any question from a round, middle or end, succeeds. The sheet import keeps its slot-keyed upsert semantics (a re-import matches stored rows by round and position), so rows can't simply all be parked. One approach: delete up front the stored rows that are neither kept by id nor on a slot a kept question moves into, then park and upsert as today. The fix may choose another approach if it keeps both id-keyed and slot-keyed behaviour.

## User Stories

1. As a quiz master, I want to delete a question from the middle of a round and save, so that the round keeps its remaining questions in order.
2. As a quiz master running a live game, I want deleting an unopened middle question to be allowed (or refused with the live-edit issues when the frontier forbids it), never a 500.
3. As a developer, I want the live-edit race test to delete the next question, so that the save-first-then-Advance order is covered as the live-edit-save spec describes.

## Testing Decisions

- Test through the quiz service with the real store: drop the first, a middle and the last question of a round; assert the remaining questions, their order and their ids.
- Cover the sheet re-import path (slot-keyed) with a shrunk round, so the fix does not break its matching.
- Change the reverse-order test in `live-edit.spec.ts` to delete the next question and assert the Advance then opens the question that now follows.

## Out of Scope

- Changes to the live-edit frontier rules or the guard.
