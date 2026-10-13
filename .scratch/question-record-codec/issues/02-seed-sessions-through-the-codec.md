# 02: Seed sessions through the codec, and stop stripping the margin

**What to build:** A session's seeded questions are built from stored rows by the question record codec, so a seeded question carries exactly the payload fields and grading settings its type allows and never a setting its type doesn't have. With that guaranteed, the block reveal views add the resolved margin on top of the seeded question without stripping a stored one first. Sessions play, grade and reveal exactly as today, including margin text on Number and none on closest_guess.

Parent spec: `.scratch/question-record-codec/spec.md`

**Blocked by:** 01 (the codec module)

**Status:** ready-for-agent

- [ ] The codec gains row → seeded question; the seed service uses it for real sessions and for the hard-coded fixture, and the comment explaining why only player-safe payload fields reach the seeded game moves with it.
- [ ] A seeded question never carries a grading setting its type's registry entry doesn't list, even when the stored payload has one.
- [ ] The block reveal views add the resolved margin (from the Answer key, as today) without removing a stored margin first; the question view conversion still resolves the margin the same way.
- [ ] The codec round-trip test gains seeded-question cases per type: every allowed payload field survives, a stray setting is dropped, unset stays unset.
- [ ] The existing seed service, live-edit and reveal/projection specs pass unchanged, including the Number margin and closest_guess no-margin assertions.
- [ ] `pnpm typecheck` and the backend and shared-types tests pass.
