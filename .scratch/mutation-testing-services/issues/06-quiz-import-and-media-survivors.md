# 06: Quiz, import and media

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `quiz.service.ts` | 18 | 3 |
| `import.service.ts` | 11 | 2 |
| `media.service.ts` | 2 | 0 |

Look like real gaps:

- `quiz.service.ts:27-28`: optional `options` and `matchTargets` are copied only when defined; the `!== undefined` tests survive `true`, `false` and `===`, and `{ matchTargets }` → `{}` has no coverage. Save a question with and without each field and assert the stored payload. `:146-147`: the same for a round's `category` and `author` (no coverage). `:252-253`: `round.category ?? null` survives `&& null`.
- `quiz.service.ts:167` and `:186`: `title.trim()` on create and rename. `:131`: the `exists` count filter `{ id: quizId }` → `{}`: a spec asking for an id that doesn't exist while another quiz does.
- `quiz.service.ts:259`, `:288`, `:305`: the `upsert` conflict options (`onConflictFields`, `onConflictAction`) can be emptied; `:352`: `roundRepo.find({ quiz: quizId })` → `{}` (a second quiz's rounds are read); `:356`: `?? []` → a non-empty array.
- `import.service.ts:55-56`: reusing a stored question id on re-import (`?.` on both lookups, `questionId === undefined`). `:72` and `:99`: `quizTitle?.trim()` for the CSV and sheet previews. `:197`: the duplicate-title lookup's `fields: ['id']`. `:79` and `:107`: the fallback messages for a CSV or sheet that can't be read (no coverage; throw a non-`Error`).
- `media.service.ts:11-12`: the unsupported-image message and name.

Look equivalent or low value (assert the message, or disable with a reason): error `name` and message strings at `quiz.service.ts:35-44`, `import.service.ts:31-42`, `media.service.ts:11-12`; the `fields: ['id']` / `populate` options (`import.service.ts:197`) when the result is only checked for existence.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Comments
