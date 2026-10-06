# 02: The team's phone toasts a new bonus award

**What to build:** When the quiz master gives a team a **bonus award**, that team's phone on `/play` pops a toast the moment the award arrives. The toast names the **bonus category**, the signed points (using the formatter from 01) and, for a custom award, the quiz master's reason. Examples: "🎉 +1 point — Selfie", "+2 points — Custom: Best team name", "−1 point — Custom: phone use". Positive awards use the success toast; penalties use a plain, neutral toast. Award toasts stay up about 8 seconds. Only a live award toasts: awards a phone gets back on rejoin don't replay. No backend change: the team-only award notice already carries category, points and reason. Spec: `.scratch/bonus-award-toast/spec.md`.

**Blocked by:** 01 (Signed bonus points everywhere)

**Status:** ready-for-agent

- [ ] A live award notice with positive points raises one success toast naming the category and signed points (player hook test with the fake socket, tested first)
- [ ] A custom award's toast includes the reason
- [ ] A penalty raises a plain (not success) toast showing negative points
- [ ] "point"/"points" is pluralised by value
- [ ] Award toasts use an ~8-second duration
- [ ] Awards restored on join or rejoin raise no toast
- [ ] The award still lands in the bonus drawer as before
- [ ] Checked in the browser (frontend :8888) that the toast doesn't cover `/play`'s bottom actions bar; adjusted only if it does
- [ ] `DOCUMENTATION.md`: the bonus points step says the awarded team's phone shows a toast for a new award (not for edits, deletions or awards restored on rejoin)
