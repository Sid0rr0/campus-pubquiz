# 03: "Regrade for a key fix" lives in the block grading module

**What to build:** A live answer-key fix is handled by one call on the block grading module, and the Live session module's quiz edit reads as reload, regrade, outcome. A change to how a key fix rescores now touches one module.

*Regrade for a key fix* takes the reloaded session, the session as it was before the edit, and the question ids the save corrected. It returns the new session, the questions it actually rescored, and the teams with an answer to one of them. Inside it:

- the previous questions come from the before-session's seeded game, so the Live session module stops building that map
- the per-type regrade runs exactly as today: auto-graded types are rescored (kahoot with speed scaling from stored response times), typed answers keep the moderator's grade on a non-match, and closest_guess re-runs only if already graded
- recomputed closest_guess summaries are merged into the returned session
- the result ends through the Grading refresh for the rescored questions
- the answering teams are read from the rescored questions' answers

The quiz edit then builds its outcome. With nothing rescored it is a plain broadcast. Otherwise it carries the rescored questions' answer lists and team syncs for the connected teams among those named. The Live session module's private regrade step goes away, and with it any temporary public refresh path left by ticket 02.

The per-answer rules stay in the answer module. The live-edit guard's choice of which questions to regrade stays where it is.

Parent spec: `.scratch/grading-policy/spec.md`

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] The block grading module exposes *regrade for a key fix* as described. The Grading refresh's halves are no longer reachable from outside it.
- [ ] The quiz edit makes one grading call and no longer merges closest_guess summaries, applies a refresh, or lists answers to find teams.
- [ ] Ticket 01's tests and the live edit regrade, quiz edited, ungraded agreement walk and answer grading specs pass unchanged.
- [ ] `docs/architecture.md`: any diagram showing the Live session module calling the answer module or the session updates helper for regrades points at the block grading module instead. `CODING_STANDARDS.md` is updated if it describes the two-call refresh. The glossary's **Grading refresh** entry still reads correctly.
- [ ] `pnpm typecheck` and the backend suite pass.
- [ ] If live-edit-save ticket 03 has landed first, the regrade call goes in its split-out quiz-edit step. Otherwise that ticket rebases onto this one.
