# 04: Kill the API clients survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

No-coverage: `app/lib/leagues-api.ts` (3, 68), `stats-api.ts` (1, 62), `teams-api.ts` (5, 34), `bonus-award-api.ts` (1, 22), `quiz-preview-api.ts` (1, 12). Survivors: `auth-api.ts` (23, 6), `sessions-api.ts` (5, 3), `quiz-draft-api.ts` (4, 1), `import-api.ts`, `quiz-api.ts`, `backend-url.ts` (3, 2), `api-error-message.ts`.

Most no-coverage mutants are clients no spec reaches directly: add specs for the request shape and the error/parse paths, with `fetch` stubbed.

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

## Outcome

Every file in the ticket now scores 100% (no survivors, no uncovered mutants), so there are no equivalent mutants to record and no `Stryker disable` comments.

- A table-driven helper, `app/lib/__tests__/api-client-contract.ts` (`describeApiClient`), runs four checks per client function with `fetch` stubbed: the exact URL and init it sends, the value it returns, the typed error (class, `name`, `status`) with the fallback message, and the server-sent message winning over the fallback. For clients that catch a non-JSON error body it also checks the fallback then.
- One `<client>.contract.test.ts` per client: `auth-api`, `leagues-api`, `stats-api`, `teams-api`, `bonus-award-api`, `quiz-preview-api`, `sessions-api`, `quiz-draft-api`, `import-api`, `quiz-api`. The draft and import specs also assert the `issues` list (defaults to `[]`).
- `backend-url.test.ts` covers the env override, the page-hostname fallback and the no-window fallback.
- `api-error-message.test.ts` gains the `undefined` (no error) case.
- Public fetches (`fetchPublicLeagues`, `fetchLeagueTable`) pass an `AbortSignal` in the spec so dropping `{ signal }` is caught.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
