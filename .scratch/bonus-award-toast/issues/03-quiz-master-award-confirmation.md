# 03: The quiz master gets a confirmation when an award is accepted

**What to build:** On `/control`, once the server accepts a **bonus award** the quiz master gave, a success toast confirms it with the signed points (formatter from 01), the **bonus category** and the team, e.g. "+1 Selfie → The Quizzly Bears". It shows whether or not the team's phone is connected. A refused award behaves as now: only the existing error toast, and the award dialog stays open with what was typed. No other admin action starts toasting on success. Spec: `.scratch/bonus-award-toast/spec.md`.

**Blocked by:** 01 (Signed bonus points everywhere)

**Status:** done

- [x] Giving a bonus that the server accepts raises one success toast naming the signed points, category and team (full admin page test with the real admin hook and the fake socket, tested first)
- [x] A penalty's confirmation shows the negative points ("−1 Custom → …")
- [x] A refused award raises only the existing error toast, no confirmation, and the dialog stays open
- [x] The shared admin action helper is unchanged, so other admin actions stay silent on success
- [x] `DOCUMENTATION.md`: the bonus points step mentions the quiz master's confirmation
- [x] `/guide` page: the bonus-award instructions mention the confirmation toast

## Comments

Implemented in the commit "feat(frontend): confirm an accepted bonus award to the quiz master". `TeamsTable`'s award handler raises `toast.success(formatBonusAwardConfirmation(...))` only when the server accepts the award; the shared admin `emitAction` helper is untouched, and a refused award still gets just the existing error toast with the dialog left open. The page-level test is `control/__tests__/bonus-award-confirmation.test.tsx`.

The `/guide` page had no bonus-award instructions at all, so I added a paragraph to its Teams section covering how to award bonus points and the confirmation toast.
