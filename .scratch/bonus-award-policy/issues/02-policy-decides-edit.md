# 02: Bonus award policy decides an edit

**What to build:** Editing a bonus award's points and reason is allowed or refused by the Bonus award policy, and the bonus store's update only stores the decided values. The quiz master sees the same edits allowed and the same refusals as today. See the spec's "Edit decision" and "The bonus store".

**Blocked by:** 01 (Bonus award policy decides a quiz master's award).

**Status:** ready-for-agent

- [ ] The policy's edit decision takes the stored award's category and points plus the requested points and reason. It returns a refusal or the points and reason to store (reason kept only for custom)
- [ ] Rules and messages as today: non-zero finite points, a custom award needs a reason, a shot or selfie award can't flip between bonus and penalty, and a custom award may flip
- [ ] Editing an award from another session is still refused as not found, by the store
- [ ] The edit rule cases move from the bonus service's database spec to the policy spec
- [ ] The bonus-changed game spec passes unchanged
- [ ] `DOCUMENTATION.md` no longer says the bonus service checks award or edit rules, if it did
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
