# 02: The picker explains which teams can't be merged

**What to build:** the merge picker shows every other team with its sessions played. A team that can't be merged with this one stays in the list, greyed out with the reason:

- "both took part in <session>", naming every clashing session
- "<team> is in a session that hasn't ended"

The moderator understands why a merge isn't offered, instead of thinking the team is missing.

This needs a merge-preview read for one team on the staff teams controller. It returns every other team as either `mergeable` or refused with a reason (`shared_session` with the session names, or `unended_session` with the team). It reuses 01's eligibility rule, so the preview and the merge always agree.

Parent spec: `.scratch/team-merge/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Preview operation in the team-merge module, built on the same eligibility rule as the merge
- [ ] Real-Postgres spec: for each refusal case from 01, the preview gives the same verdict and reason as the merge, and mergeable pairs are marked mergeable
- [ ] Preview read on the staff teams controller, with payload types in shared types. Controller unit spec.
- [ ] Picker lists sessions played per team, greys out refused teams with their reason, and offers only mergeable teams for the next step. Vitest with mocked fetch.
- [ ] `DOCUMENTATION.md` Teams section mentions the preview read
