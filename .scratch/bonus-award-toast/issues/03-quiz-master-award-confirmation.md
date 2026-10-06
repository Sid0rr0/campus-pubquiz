# 03: The quiz master gets a confirmation when an award is accepted

**What to build:** On `/control`, once the server accepts a **bonus award** the quiz master gave, a success toast confirms it with the signed points (formatter from 01), the **bonus category** and the team, e.g. "+1 Selfie → The Quizzly Bears". It shows whether or not the team's phone is connected. A refused award behaves as now: only the existing error toast, and the award dialog stays open with what was typed. No other admin action starts toasting on success. Spec: `.scratch/bonus-award-toast/spec.md`.

**Blocked by:** 01 (Signed bonus points everywhere)

**Status:** ready-for-agent

- [ ] Giving a bonus that the server accepts raises one success toast naming the signed points, category and team (full admin page test with the real admin hook and the fake socket, tested first)
- [ ] A penalty's confirmation shows the negative points ("−1 Custom → …")
- [ ] A refused award raises only the existing error toast, no confirmation, and the dialog stays open
- [ ] The shared admin action helper is unchanged, so other admin actions stay silent on success
- [ ] `DOCUMENTATION.md`: the bonus points step mentions the quiz master's confirmation
- [ ] `/guide` page: the bonus-award instructions mention the confirmation toast
