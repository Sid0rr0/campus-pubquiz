# 01: A free_text answer that doesn't match the answer key waits for the moderator

**Status:** ready-for-agent

**Blocked by:** None (can start immediately)

**What to build:** Today a free_text answer is graded the moment a team submits it. A match is marked correct with full points; **anything else is marked incorrect with 0 points and counts as graded** (`scoreBase` in `shared/types/src/scoring.ts`, `gradedAt` set in `AnswerService.submit`). So a synonym or a near-miss spelling is silently marked wrong and never shows up as needing grading.

New rule: **only a submission that matches the answer key is graded automatically. A submission that doesn't match is left ungraded for the moderator**, exactly like an audio or youtube answer.

"Matches" keeps today's comparison (`normalizeFreeText`: trimmed and case-insensitive, so "Paris" / " paris " / "PARIS" all match). This ticket doesn't make it any stricter.

### Behaviour

- **Submit, match:** correct, full points, graded at submit (unchanged).
- **Submit, no match:** ungraded (no grading time, no verdict, 0 points). The question shows as ungraded on `/control`, and Advance out of the break is refused until the moderator grades it, the same gate as audio and youtube.
- **Revision:** last write wins, as today.
  - The new value matches: graded correct automatically, replacing any earlier grade.
  - The new value doesn't match and differs from the previous value: back to ungraded, even if the moderator had graded the previous value. This is the same reset audio and youtube already do in `submit`.
  - The same value is resubmitted: the grade is left alone, so a moderator's grade survives.
- **Moderator grading:** unchanged. The moderator can still override any free_text answer, matching or not.
- **Live answer-key fix** (`regradeAutoGraded`):
  - Answers that match the corrected key are graded correct.
  - A non-matching answer the moderator graded keeps their grade.
  - Any other non-matching answer becomes ungraded, including one that was auto-graded correct under the old key.

  How "the moderator graded it" is told apart (compare against the old key, or record how an answer was graded) is the implementer's call.

- **Kahoot:** not affected, since free_text isn't allowed in kahoot rounds (ADR 0001).
- **Existing answers:** no data migration. Answers already stored as incorrect stay as they are.

### Where the rule lives

The project guide says per-type grading knowledge comes from the question type registry (`QUESTION_KINDS`). free_text is `gradingMode: 'auto'` today, and `submit` uses `isAutoGradedType` both to score and to decide whether a revision resets a grade. Express "auto-graded on a match, otherwise human" through the registry and scoring (a new grading mode, or the score result saying "no automatic verdict"), not with a `type === 'free_text'` check in the answer service.

### Docs to update in the same commit

- `DOCUMENTATION.md`: the `free_text` entry in the question-type list, the "auto-graded the instant a team submits" paragraph, and the live-edit regrade paragraph
- `free_text`'s `moderatorNote` in `shared/types/src/question-kind.ts`
- The `/guide` page, wherever it tells the moderator what they have to grade
- The project guide's "Live answer-key fixes overwrite manual overrides" tradeoff: a free_text answer the moderator graded now survives a key fix

### Tests

- Scoring: a non-matching free_text submission produces no automatic verdict, and a matching one is correct
- Through the real-store gateway harness:
  - A wrong free_text answer puts its question on the admin view's ungraded list and blocks Advance out of the break until graded
  - A revision into a match takes it off the list; a revision into a different non-match puts it back
- `ungraded-agreement.spec.ts` (ungraded-source 01): its free_text steps currently expect a wrong answer to stay off the list. Flip them to the new rule, so the walk keeps proving the view and the database agree.

## Acceptance criteria

- [ ] A free_text submission matching the answer key (trimmed, case-insensitive) is graded correct at submit
- [ ] A free_text submission that doesn't match is stored ungraded and appears in the admin view's ungraded list
- [ ] Advance out of the break is refused while a non-matching free_text answer is ungraded
- [ ] Revising into a match auto-grades it; revising into a different non-match resets it to ungraded; resubmitting the same value keeps the grade
- [ ] A live answer-key fix grades new matches correct, keeps the moderator's grades, and leaves other non-matches ungraded
- [ ] The rule is expressed through the question type registry / scoring, with no free_text literal in the answer service
- [ ] The agreement walk is updated and passes; existing grading specs pass
- [ ] `DOCUMENTATION.md`, the registry's moderator note, `/guide` and the project guide's tradeoff are updated
