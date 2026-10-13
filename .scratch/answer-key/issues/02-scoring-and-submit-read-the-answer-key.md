# 02: Scoring and submit read the Answer key

**What to build:** Every answer grades exactly as it does today, but Scoring works out the Answer key once at its interface, so no answer format fills in a default of its own. The answer module's submit builds the question it grades through the Answer key, instead of naming each grading setting itself.

- **Scoring's public functions** (scoring a submission, the submit-time grade, the closest_guess batch, the verdict for a hand grade) keep accepting today's question shape, so no call site changes. Each one works out the Answer key on entry and passes it to the answer formats.
- **The answer formats' keyed-question type becomes the Answer key**, with its settings required. The Number format reads the margin directly, with no `?? DEFAULT_MARGIN`. The match format reads the scoring mode directly, with no "undefined behaves as partial" fallback.
- **The answer module's submit** builds its question through the Answer key from the stored row and payload. It no longer copies `matchScoringMode` and `margin` field by field.

Parent spec: `.scratch/answer-key/spec.md`

**Blocked by:** 01 (Answer key module, used by the live-edit guard).

**Status:** done

- [ ] Nothing inside Scoring or its answer formats falls back to a default margin or scoring mode. The settings arrive filled in.
- [ ] `scoring.test.ts`, `number-question-margin.test.ts`, `scoring-pinned-base-scores.test.ts` and `answer-kind.test.ts` pass unchanged.
- [ ] The answer module's submit, auto-grading and verdict specs, and the gateway grading specs, pass unchanged.
- [ ] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
- [ ] If `grading-mode-policy` has landed first, rebase onto it. Its policy keeps accepting today's question shape, so no conflict beyond the submit line is expected.
