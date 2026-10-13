# 03: Phone, big screen and quiz editor read grading settings through the Answer key

**What to build:** The phone, the big screen and the quiz editor show the same margin and scoring mode as today, and as grading uses, but each one reads them through the Answer key instead of filling in its own default.

- **The phone and big screen's margin text** ("within 10%") gets the margin from the Answer key's grading settings. The margin text no longer has its own default margin.
- **The big screen's Number reveal** ("200 · 180–220 accepted") reads the margin through the Answer key, with no `?? DEFAULT_MARGIN`.
- **The quiz editor's load** reads the margin and the match scoring mode it shows from the Answer key, with no `?? DEFAULT_MARGIN` and no `?? 'partial'`. A brand-new question's initial values are a separate case: they set a value rather than interpret a missing one. They may stay as they are or read the same module, whichever reads more clearly.
- **`CODING_STANDARDS.md`:** in "Question types are defined once", add that a question's grading settings are read through the Answer key, never by defaulting an optional field at the call site.

Parent spec: `.scratch/answer-key/spec.md`

**Blocked by:** 01 (Answer key module, used by the live-edit guard). It can run in parallel with 02.

**Status:** done

- [x] No frontend code outside the new-question initial values applies the default margin or the default scoring mode itself.
- [x] The frontend margin-text, display reveal, question display, play break-and-reveal, quiz draft state and quiz editor panel tests pass unchanged.
- [x] CODING_STANDARDS.md has the new line.
- [x] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
