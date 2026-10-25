# 03: Kill the Quiz editor draft state survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/quizzes/[id]/quiz-draft-state.ts` (33), `answer-kind-drafts.ts` (22, 3), `use-quiz-draft.ts` (23, 2), `use-quiz-import.ts` (13, 2), `app/stats/[id]/format-response-ms.ts` (2).

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.

## Outcome

Level chosen: direct specs for the pure modules (`quiz-draft-state.ts`, `answer-kind-drafts.ts` through it, `format-response-ms.ts`) and `renderHook` specs for the two hooks (`use-quiz-draft.test.tsx`, `use-quiz-import.test.tsx`), since the panel tests only reach the hooks through the DOM and left them unkilled. Every file now reports zero survivors and zero no-coverage mutants.

Equivalent mutants, marked in source with `// Stryker disable next-line <mutator>: <reason>`:

- `answer-kind-drafts.ts` shuffle loop `i > 0` to `i >= 0`: at `i = 0` the only `j` is 0, a swap with itself.
- `use-quiz-draft.ts`:
  - the `?? 'Could not save the quiz.'` second fallback is reached only for a null error, which a rejected save never carries;
  - the `-1` placeholder query key is never read, because the query is disabled for a new quiz;
  - dropping `setMergedDraft` in the hydration branch only makes the next render run the backfill once, which changes nothing on freshly hydrated rounds;
  - `run + 1` to `run - 1` on the saved-flash counter: it only has to change to restart the timer;
  - `if (!savedFlash) return` to `if (false)`: with the flash already off, the timer only sets it off again.
