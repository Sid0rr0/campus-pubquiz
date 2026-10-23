# 07: Question schemas and CSV codecs (import boundary)

Status: needs-triage

The import boundary is where a bad sheet has to be refused before it reaches the stage (CLAUDE.md "JSON payload column").

| File                          | Survived | No coverage | Killed |
| ----------------------------- | -------- | ----------- | ------ |
| `question-preview-schema.ts`  | 43       | 0           | 52     |
| `question-row-schema.ts`      | 32       | 6           | 64     |
| `question-csv-codec.ts`       | 28       | 7           | 31     |
| `quiz-preview.ts`             | 26       | 0           | 90     |
| `question-kind.ts`            | 17       | 0           | 27     |
| `question-view-conversions.ts`| 12       | 2           | 13     |
| `media.ts`                    | 12       | 0           | 19     |
| `question-record-codec.ts`    | 9        | 0           | 58     |

Examples:

- Trimming isn't asserted: `question-csv-codec.ts:35-38` (option split, trim and blank filter), `question-row-schema.ts:48-49` (category trim and blank check), `question-preview-schema.ts:16` (`item.trim()`), `quiz-preview.ts:57`.
- `question-preview-schema.ts:21`: the URL protocol regex `/^https?$/` survives losing either anchor, or the `?` (which would refuse plain `http`).

Likely equivalent or noise: `question-kind.ts:87-135` are the help-text strings shown to authors. Either assert one of them, or add a `// Stryker disable StringLiteral` block with a reason.
