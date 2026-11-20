# 01: One counted-points step for joker doubling

**What to build:** Every TypeScript place that turns an answer's stored points into the points it counts for goes through one shared step, `countedPoints(pointsAwarded, isDoubled)`, in the **Doubled rounds** module. It returns the stored points multiplied by `JOKER_MULTIPLIER` when the answer is in a **Doubled round**. The read-model cells (scoresheet, session detail, team history), the joker fun facts (best joker, joker backfired) and the phone's "+N" joker bonus on a revealed answer all call it. `cellPoints` and `jokerRoundPoints` are deleted and nothing else multiplies by the joker. The standings SQL stays as the step's set-based twin. Its doc comment names `countedPoints`, and the parity spec now also checks that the two agree.

Nobody sees a difference: totals, cells and their joker marks, fun facts and the "+N" all stay the same. ADR 0004 stands (doubling stays derived). See the spec's Implementation Decisions.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `countedPoints` lives in the Doubled rounds module, and a pure `shared/types` test covers doubled, not doubled, zero and negative points. `JOKER_MULTIPLIER` stays exported for the SQL.
- [x] `cellPoints` and `jokerRoundPoints` no longer exist. The scoresheet, session detail and team history pass each answer's existing `isJoker` to `countedPoints`, and their specs still pass unchanged.
- [x] Fun facts' best-joker and backfired figures come from `countedPoints` (extra points = counted minus stored), and the existing fun-facts tests pass, including a case with an extra joker.
- [x] The phone's "+N" joker bonus uses `countedPoints`. It still shows nothing on a zero or ungraded answer, and its tests pass.
- [x] The doubled-rounds parity spec compares, for every existing case, each team's standings round total from SQL with the sum of `countedPoints` over that team's answers, where `isDoubled` comes from `doubledRoundIds`.
- [x] `pnpm crap:changed` and `pnpm mutate:changed` are clean on the touched files.
