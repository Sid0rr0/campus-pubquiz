# 05: Team phones: synced closest_guess points and the verdict

**What to build:** A team's phone shows the points it actually got for a closest_guess question, from its graded answers synced at reveal entry, instead of re-deriving them by looking up its team name in the reveal list. Wherever the phone shows a graded answer, it shows the verdict (correct / partial / incorrect) the quiz master sees. See [spec](../spec.md) user stories 14 and 15.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Frontend tests: a team's closest_guess points come from its synced graded answer, including when its team name differs from the reveal list's entry (e.g. renamed), and are 0 when another team was closest.
- [ ] Frontend tests: the team's answered-questions view labels each graded answer with its verdict, and a partial match answer shows as partial.
- [ ] No client code infers correctness by comparing points to the question's points.
