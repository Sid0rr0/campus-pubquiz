# 07: Kill the Play, display and component view helpers survivors

Status: ready-for-agent

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/display/fun-fact-wording.ts` (10), `use-media-pause.ts` (7, 1), `app/play/use-phone-question-browser.ts` (10), `feedback-draft.ts` (5, 2), `verdict-card.ts` (5), `opened-questions.ts` (4), `joker-round.ts`, `my-standing.ts`, `app/components/leaderboard-rows.ts` (5), `app/lib/quiz-csv-export.ts` (3), `quiz-preview-position.ts` (4), `option-letters.ts`, `placing-text.ts`.

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
