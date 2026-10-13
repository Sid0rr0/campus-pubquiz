# 02: Placement grades through `gradeForPlacement`; step methods go private

**What to build:** Placing a session (session creation in the lobby, or restart restore) grades through one Block grading call. That call rebuilds the closest_guess summaries without re-scoring any question, then refreshes the ungraded set for the block in play. The stale answer lists are dropped on purpose inside the module, because no socket is connected during placement. A backend restart mid-quiz still restores a correct ungraded set and closest_guess reveal from the first snapshot, with no stored points changed.

With both callers moved, Block grading's public interface shrinks to four methods: `gradeForMove`, `gradeForPlacement`, `gradesChanged` and `regradeForKeyFix`.

See the parent spec: `.scratch/block-grading-moves/spec.md`.

**Blocked by:** 01 (Progress moves grade through `gradeForMove`)

**Status:** ready-for-agent

- [ ] Block grading exposes `gradeForPlacement(session, progress)`, returning the session; the reason stale answer lists are dropped is stated in the module, not at the call site
- [ ] Commit a move's `place()` makes one `gradeForPlacement` call
- [ ] The speed scoring, the batch, the bulk refresh, the ungraded-set readers and the reveal gate are private; `canBeUngraded` stays exported
- [ ] New harness case (test-first): a restart while in a break restores the ungraded set and the closest_guess summary without changing any stored points
- [ ] Ungraded restore, persistence and quiz selection, live-edit regrade and core snapshot specs pass with unchanged assertions (core snapshot updates only calls to now-private methods)
- [ ] GLOSSARY's **Commit a move** entry mentions the reveal gate (or a short **Reveal gate** entry is added); the architecture diagram shows the two move entry points if its Block grading node lists steps
- [ ] Full backend suite, `pnpm typecheck` and `pnpm lint` pass
