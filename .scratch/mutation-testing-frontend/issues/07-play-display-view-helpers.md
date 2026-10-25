# 07: Kill the Play, display and component view helpers survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/display/fun-fact-wording.ts` (10), `use-media-pause.ts` (7, 1), `app/play/use-phone-question-browser.ts` (10), `feedback-draft.ts` (5, 2), `verdict-card.ts` (5), `opened-questions.ts` (4), `joker-round.ts`, `my-standing.ts`, `app/components/leaderboard-rows.ts` (5), `app/lib/quiz-csv-export.ts` (3), `quiz-preview-position.ts` (4), `option-letters.ts`, `placing-text.ts`.

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

## Outcome

Every file in the list now scores 100% (killed + timeout) in a one-file `pnpm --filter frontend mutate` run. Real gaps were killed with direct specs (new: `fun-fact-wording`, `use-media-pause` and `use-phone-question-browser` hook specs via `renderHook`, `feedback-draft`, `joker-round-helpers`, `my-standing`, `quiz-preview-position`, `option-letters`) and added cases in `leaderboard-rows.test.ts` (tie at the top, a tie below two clear places, old-phase `rankIndex`, no `trend` key) and `opened-questions.test.ts` (sort by round then position when ids disagree). `verdict-card.ts` had no survivors left.

Equivalent mutants, marked with `// Stryker disable`:

- `use-media-pause.ts` `element.muted !== isMuted` guard (ConditionalExpression): it only skips assigning the value already there.
- `my-standing.ts` `teamId === null` early return (ConditionalExpression): a null id matches no entry, so the `find` returns null anyway.
- `quiz-csv-export.ts` `csvFilename` slug: `.trim()` (edge whitespace becomes a hyphen that is stripped again) and the `^-+|-+$` regex (the previous replace leaves at most one hyphen in a row, so `^-` and `-$` strip the same text).
- `quiz-preview-position.ts` `at === null` early return (ConditionalExpression): no step position equals null, so `findIndex` gives -1 and the `Math.max` gives 0.
- `placing-text.ts` teen bounds (EqualityOperator): 10 and 20 end in 0, which takes "th" from the fallback.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
