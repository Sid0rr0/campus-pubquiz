# 03: The editor and `/guide` take mode labels from shared types

**What to build:** Quiz writers see each scoring mode under the same name in the quiz editor and on the `/guide` page, and the guide's scoring line can't fall behind the app, as the [spec](../spec.md) describes. The labels keep the editor's current text: "Exact order only", "Points per item in place", "Half points for one mistake".

- **The labels** move into the scoring-mode module (shared types) as one label per mode, typed so a missing label is a compile error. Wording that differs between sort and match is out of scope.
- **The quiz editor's Scoring select** drops its own label map and uses the shared one. It still lists only the modes the question's type accepts, and shows the default when the mode is unset.
- **The `/guide` page's** CSV notes bullet builds its `{scoring: …}` sentence from the per-type table from ticket 01 and the type labels, the same way the page already builds its type list from the registry. Keep it within the guide's word cap.
- This is the spec's only guide ticket.

**Blocked by:** 01 (Each type's scoring modes come from one table)

**Status:** ready-for-agent

- [ ] The editor has no scoring-mode label map of its own; its Scoring select shows the same options and labels as before
- [ ] The guide-content test checks that the scoring line names each mode-carrying type's modes, read from the shared table rather than hard-coded
- [ ] `pnpm typecheck` and `pnpm --filter frontend test guide-content` pass
