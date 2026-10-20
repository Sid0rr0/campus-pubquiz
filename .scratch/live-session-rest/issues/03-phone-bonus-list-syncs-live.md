# 03: The phone's bonus list syncs live

**What to build:** When the quiz master edits or deletes a team's **bonus award**, that team's phone updates its bonus list straight away, with no toast. Today the phone only picks the change up on its next rejoin. A fresh award behaves as today: the phone appends it and shows the toast. Only the awarded team's own socket hears about it.

A new server-to-client event, the team bonus awards sync, carries the team's full bonus award list. It uses the `TeamBonusAwardView` list shape that the join-accepted payload's bonus awards use, in award order.

The session outcome gets a per-team bonus sync list, built like the team syncs and player count syncs: connected teams only, each with its socket. The edit and remove changes from ticket 02 add the award's team. A disconnected team gets nothing and catches up on rejoin.

The delivery step reads each listed team's awards with the bonus service's existing per-team list. It emits the sync to that socket only, alongside the other per-team syncs and before the notices. A fresh award keeps its `BONUS_AWARDED` notice and gets no sync.

On the phone, the team link replaces its bonus award list with the synced list and raises no toast.

Docs in the same change:

- `DOCUMENTATION.md`: the protocol section gets the new event and its payload.
- `GLOSSARY.md`, **Team link**: the team's own bonus awards are kept current live, not only at join.
- `GLOSSARY.md`, the delivery step's entry: lists the team bonus awards sync.

See the spec's "The phone's bonus list syncs live".

**Blocked by:** 02 (Bonus edits and deletions inside the Session write)

**Status:** ready-for-agent

- [ ] Through the real-store harness: after an edit, the awarded team's socket gets the sync with the new points and reason; no other socket gets it; no `BONUS_AWARDED` notice goes out
- [ ] After a deletion, the awarded team's socket gets a sync without the award
- [ ] A disconnected team gets no sync, and a later rejoin's join-accepted payload carries the current list
- [ ] A fresh award still sends `BONUS_AWARDED` (toast) and no sync
- [ ] The sync's place in delivery order is covered alongside `outcome-delivery-order.spec`
- [ ] Frontend (Vitest): the team link replaces its bonus list on the sync and raises no toast
- [ ] `DOCUMENTATION.md` protocol section and `GLOSSARY.md` (Team link, delivery step) updated
- [ ] `pnpm typecheck`, `pnpm lint`, and the backend and frontend tests pass
