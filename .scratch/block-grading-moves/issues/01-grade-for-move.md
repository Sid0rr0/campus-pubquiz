# 01: Progress moves grade through `gradeForMove`

**What to build:** Every progress move (an admin press, or a question lock or kahoot timer expiry) grades what it implies through one Block grading call. Given the session as it stood before the press and the progress the move leads to, Block grading runs, in order:

1. the reveal gate: refuse leaving `break_intro`/`break` for `reveal_intro` while any question in the block in play is ungraded, read fresh from the database
2. the kahoot speed scoring when a kahoot question leaves `locking`
3. the closest_guess batch when the move reaches a graded status
4. the whole-block Grading refresh when it reaches a break status

It returns the graded session and the questions whose admin answer list is stale. Quiz masters and teams see no difference. The order is now written once, in Block grading, instead of in comments at the call site.

See the parent spec: `.scratch/block-grading-moves/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Block grading exposes `gradeForMove(session, to)`, returning the graded session and `staleAnswerListIds`
- [x] The reveal gate moves into Block grading unchanged: same condition, same ungraded-answers error naming the questions, run before any grading write
- [x] Commit a move's progress-move path makes one `gradeForMove` call, then settles, saves and builds its outcome as today; its own reveal-gate method is removed
- [x] New harness case (test-first): leaving `break` for the reveal with an ungraded question is refused, and the session stays in `break` with its ungraded set unchanged
- [x] New harness case: a block ending on a closest_guess question enters its break with that question absent from the ungraded set and its admin answer list re-sent
- [x] New harness case: a kahoot block whose last question leaves `locking` into its break shows speed-scaled points in the answer lists and a correct ungraded set
- [x] Grading gate, ungraded agreement, kahoot answer speed, kahoot question auto-advance, closest_guess reveal, question lock auto-advance and previous-to-lobby specs pass with unchanged assertions
- [x] Backend suite and `pnpm typecheck` pass
