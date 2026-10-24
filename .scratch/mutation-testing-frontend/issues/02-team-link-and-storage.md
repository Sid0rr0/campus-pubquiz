# 02: Kill the Team link and browser storage survivors

Status: ready-for-agent

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/lib/use-team-link.ts` (54 survived, 9 no coverage), `team-link.ts` (25, 4), `team-storage.ts` (1, 1), `player-count-prompt-storage.ts` (5, 1), `seen-questions.ts` (2, 1), `player-settings-storage.ts`, `display-code-storage.ts`.

The reconnect/team identity path, so real gaps matter most here (see `CODING_STANDARDS.md` on the reconnect path). Decide per cluster between a direct spec on the module and a sharper assertion in the existing join/reconnect component specs.

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
