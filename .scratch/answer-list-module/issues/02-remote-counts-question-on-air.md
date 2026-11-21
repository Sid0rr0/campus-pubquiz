# 02: /remote counts the question on air

**What to build:** On the presenter remote, "N correct" counts the answers to the question on air. It shows as soon as the remote opens on a question that already has answers, is right again straight after a reconnect, doesn't change when teams answer another question, and is hidden when no question is on air (title cards, breaks, the leaderboard). The remote asks the Answer list hook for the snapshot's current question, or none. The admin game hook's live answers slot is then unused and gets deleted. See the spec's "Readers" and "Docs".

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `/remote` page tests: "N correct" counts the question on air; it's hidden with no question on air; a broadcast for another question doesn't change it
- [ ] The admin game hook has no live answers slot left
- [ ] `DOCUMENTATION.md` and the `/guide` page say the remote's "N correct" counts the question on air, wherever they describe that figure
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
