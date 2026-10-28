# 01: Restore hands placement the persisted progress whole

**What to build:** Moderators and teams see no change. A backend restart resumes every session at the same question, status, phase timer, opened questions and revealed kahoot questions, and a new session still starts in the lobby. Under the hood, what a session saves has one name from load to placement, as the [spec](../spec.md) describes.

- **One name.** The persisted progress (the repository's type) is the only name for what a session saves. It is the saved phase timer plus the progress and the id sets, so the phase-timer fields are declared once. The saved placement type is deleted.
- **Placement's interface.** The move committer's `place` takes the session and the persisted progress, or `null`. With `null` it places at the lobby progress. With a value it places at the saved progress and resumes the saved phase timer and id sets. Restart restore passes exactly what the repository loaded; session creation passes `null`. Nothing splits the saved data and rejoins it.
- **Load fills in the old case.** The repository's `load` turns a `null` opened-questions column into an empty list, next to its retired-`locked` status mapping, so the id sets are plain lists from then on. Settle already derives every opened question from the restored position. The column stays nullable and old rows aren't rewritten, so there is no migration.
- **Save is unchanged.** The move committer still builds the persisted progress from the committed session, and every column is written as today.
- Settle's id-set growing is ticket 02, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The saved placement type is gone, and no caller of `place` splits the loaded data
- [x] The existing real-store `restart()` specs (opened questions, ungraded restore, phase timer lifecycle, kahoot) pass unchanged
- [x] A repository case: a row whose opened-questions column is `null` loads as an empty list
- [x] A restart case, if none exists yet: a kahoot question revealed before the restart still refuses an answer after it
- [x] `pnpm typecheck` and the backend specs pass
