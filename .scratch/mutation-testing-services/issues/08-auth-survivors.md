# 08: Auth

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `auth.service.ts` | 11 | 0 |
| `auth-bootstrap.service.ts` | 4 | 0 |
| `session.service.ts` | 4 | 0 |

Look like real gaps:

- `session.service.ts:57`: `expiresAt.getTime() <= Date.now()` survives `<`: a session that expires at exactly now (fake the clock) is still valid. `:53-54`: the lookup by `tokenHash` and `populate: ['user']` survive `{}` and `[]`: a spec that finds a session by token with other sessions present, and reads `.user` without a second query.
- `auth.service.ts:63` and `:84`: `username.trim()` on register and log-in (padded usernames). `:75-76`: the unique-violation catch in registration (the block can be removed and the test `true` passes): a duplicate registration race must be swallowed, any other error rethrown. `:126`: `findAll` ordered by `createdAt asc` (survives `{}`, `orderBy: {}`, `""`): list users created out of id order.
- `auth-bootstrap.service.ts:39`: `findOne({ username })` → `{}`: a spec with another user present that must not be promoted.

Look equivalent or low value (assert the message, or disable with a reason): error `name` and message strings at `auth.service.ts:33-40`; the bootstrap log lines and the "no admin" message (`auth-bootstrap.service.ts:33`, `:45`, `:56`).

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Comments
