# 01: A save that drops a middle question succeeds

**What to build:** `QuizService.syncRoundsAndQuestions` must handle a draft that drops a question from the middle of a round. Today only kept questions are parked before the upserts, so a survivor moving into a dropped question's slot collides with that still-present row on `questions_round_id_order_index_unique`. Remove (or otherwise clear) the dropped rows before the survivors are upserted, without breaking the sheet import's slot-keyed matching. Then change the reverse-order race test in `apps/backend/src/game/__tests__/live-edit.spec.ts` to delete the next question instead of rewording its prompt.

Parent spec: `.scratch/delete-middle-question/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Failing test first: saving a round with its middle question dropped throws today, and passes after the fix.
- [x] First, middle and last question drops all save; remaining questions keep their ids and close up their order.
- [x] A sheet re-import that shrinks a round (slot-keyed) still matches by round and position.
- [x] The reverse-order test in `live-edit.spec.ts` deletes the next question: the save lands first, then the Advance opens the question that follows.
- [x] Existing quiz, import and live-edit specs pass unchanged otherwise.
