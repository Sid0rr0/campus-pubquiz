# 03: Kill the Quiz editor draft state survivors

Status: ready-for-agent

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/quizzes/[id]/quiz-draft-state.ts` (33), `answer-kind-drafts.ts` (22, 3), `use-quiz-draft.ts` (23, 2), `use-quiz-import.ts` (13, 2), `app/stats/[id]/format-response-ms.ts` (2).

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
