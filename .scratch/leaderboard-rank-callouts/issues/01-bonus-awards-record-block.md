# 01: Bonus awards record the block they were awarded in

**What to build:** a bonus award (shot, selfie or custom) remembers the block in play when it was awarded. Later, a past block's board (ticket 05) can then count it in the right block. Awards made before this change have no block and count in the latest board only.

Spec: [../spec.md](../spec.md)

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Bonus awards store the block in play when awarded, identified the way prior standings are (the block's first question id). The new field is empty for older awards. Migration generated with `db:migrate:create`.
- [ ] The bonus awards in the live results (fun fact data) carry their team and block.
- [ ] A DB-backed bonus-award spec checks that an award stores the block in play and that the live results carry it with its team.
- [ ] `DOCUMENTATION.md` notes that a bonus award records its block.
- [ ] No `/guide` text (there is nothing for the moderator to see yet).
