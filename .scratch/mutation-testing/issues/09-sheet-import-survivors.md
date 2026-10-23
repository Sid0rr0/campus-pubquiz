# 09: Backend sheet import: URL fetcher, CSV parser, draft schema

Status: done

Blocked by: None

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

## Decisions (2026-10-23)

- Priority: high. Do the redirect test first.
- **Redirect test:** the rejection tests in `sheet-url-fetcher.spec.ts` pass for the wrong reason. `mockResolvedValue` keeps redirecting, so with an empty trusted suffix the fetch still fails at the second redirect. Mock one redirect to the untrusted host followed by a 200 CSV (`mockResolvedValueOnce` twice), then assert it rejects with `SheetFetchError` and that `fetch` was called once. Do the same for the lookalike-host test.
- **Anchors:** add cases that kill the dropped `^` on `SHEET_PATH_PATTERN` and `GID_PATTERN`, such as a path with a prefix before `/spreadsheets/d/` and a gid like `x12`.
- **Empty CSV:** add a DB-free case for the empty-CSV refusal in `sheet-csv.parser.ts:69-70`, plus a header with a run of separators for `:39`.
- **Messages:** assert `NOT_SHARED_MESSAGE` and `TIMEOUT_MESSAGE`, which moderators see. Disable the `this.name = '…Error'` string mutants with a reason.
- `quiz-draft.schema.ts` and `question-row.schema.ts` survivors get tests.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
