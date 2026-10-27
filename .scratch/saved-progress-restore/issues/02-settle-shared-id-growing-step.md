# 02: Settle grows every remembered id list through one shared step

**What to build:** Moderators and teams see no change. Opened questions and revealed kahoot questions still only ever grow, including when Previous steps back and after a restart. Under the hood, Settle grows every such list through one shared step, as the [spec](../spec.md) describes, so the next list the session must remember across a restart supplies only its own rule.

- **The shared step** takes the session's stored ids and the ids the new position implies, and returns them de-duplicated in first-seen order. It owns the ordering and the "only ever grows" guarantee.
- **Each list's rule** supplies only "what this position implies". For opened questions that's every past block's questions plus the block in play. For revealed kahoot questions it's the ones the position has moved past plus the one being revealed now. The withOpenedAt and withRevealedKahootAt names go away or become those rule functions.
- This ticket touches shared types only. Placement and the repository are ticket 01.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The existing session-settle cases for both lists (grows only, derived for a session saved before they were stored) pass unchanged
- [ ] One new case: a list's stored ids are kept when the new position implies none of them (Previous stepping back)
- [ ] Settle produces both lists only through the shared step
- [ ] `pnpm typecheck` and `pnpm --filter @campus-pubquiz/types test session-settle` pass
