# 01: Bonus award policy decides a quiz master's award

**What to build:** A quiz master's bonus award (and the coin award given with it) is allowed or refused by one pure **Bonus award policy** in shared types, and the bonus service only stores what the policy allowed. Quiz masters and teams see no difference: the same awards pass, the same refusals arrive with the same messages, and the same bonus and coin toasts reach the same phones.

- The policy takes the session, the requested award and the team's existing award count in that category. It returns a refusal message or the award to store: the category and points (or none for 0 points), the trimmed reason kept only for custom, the shot/selfie coins earned, the manual coins with their reason, and the block for a new award.
- The bonus store's award call takes one record of what to store instead of nine positional arguments.
- A showdown win and the covering coin award (added when a deleted award's coins were already spent) call the store for what they mean, with no policy and no dummy arguments.

See the spec's "The Bonus award policy", "The bonus store" and "Callers".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The policy checks, in this order: coin award refusal (quickfire, then power-ups off), take refusal, zero or non-finite points with no coins, category not enabled, custom without a reason, team not on the session's roster, the cap. Category, reason and cap apply only when points are non-zero
- [ ] Every refusal message is unchanged word for word, and the change module turns a policy refusal into the existing invalid-award refusal
- [ ] "Coins need power-ups" is checked once
- [ ] The store's award call takes one record and persists the bonus award, its linked shot/selfie coins and any manual coins in one flush, as today
- [ ] The showdown win stores a custom award with today's "Showdown: …" reason and pays out even when the session has custom awards off or capped (new gateway case)
- [ ] The covering coin award is stored through its own store call with today's reason, and stores no bonus award
- [ ] The award rule cases live in a pure shared-types policy spec. The bonus service's database spec keeps only storing, counting and reading
- [ ] The award-bonus, bonus-changed, coin-awards, team-coins, carried-coin, grade-and-bonus-write and showdown game specs pass unchanged
- [ ] `GLOSSARY.md` has **Bonus award policy**, and **Showdown** says the win's custom award ignores the session's bonus categories and caps
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
