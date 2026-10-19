# 01: Shorten the `/guide` page

**What to build:** Rewrite the prose in `apps/frontend/app/guide/guide-content.tsx` to roughly a third of its length, as described in the spec: short steps and bullets, no rationale, thin sections merged, the CSV column reference cut down to a link to the template.

Parent spec: `.scratch/guide-trim/spec.md`

**Blocked by:** none

**Status:** done

- [x] The page is about 1,000–1,200 words, with no paragraph over ~300 characters.
- [x] Question types and shortcuts are still rendered from `QUESTION_KINDS` and `ADMIN_SHORTCUTS`.
- [x] Every fact pinned by `guide-content.test.tsx` is still on the page; the frontend Vitest suite passes.
- [x] No raw status names; glossary terms are used.
