# 09: Backend sheet import: URL fetcher, CSV parser, draft schema

Status: needs-triage

| File (`apps/backend/src/`)    | Survived | No coverage | Killed |
| ----------------------------- | -------- | ----------- | ------ |
| `import/sheet-url-fetcher.ts` | 38       | 3           | 79     |
| `quiz/quiz-draft.schema.ts`   | 10       | 24          | 60     |
| `import/sheet-csv.parser.ts`  | 17       | 3           | 33     |
| `import/question-row.schema.ts` | 4      | 1           | 74     |

Survivors with a security angle (check first):

- `sheet-url-fetcher.ts:21`: `TRUSTED_REDIRECT_HOST_SUFFIX = '.googleusercontent.com'` → `""` survives. If an empty suffix means any redirect host is trusted, no test proves an untrusted redirect gets refused.
- `sheet-url-fetcher.ts:9-10`: `SHEET_PATH_PATTERN` and `GID_PATTERN` survive losing their `^` anchor.

Others:

- `sheet-csv.parser.ts:69-70`: the empty-CSV refusal isn't covered by the DB-free specs (`sample-quiz-import.spec.ts` is left out of the Stryker run, see README). `:39`: the header normaliser `/[\s-]+/g` → `/[\s-]/g` survives, so no test has a run of separators.
- `quiz-draft.schema.ts:82-86`: the `round.author` type check isn't covered at all.
- Error `name` and message strings (`SheetFetchError`, `SheetFormatError`, user-facing copy) survive. Assert the ones the frontend shows, and disable the rest.
