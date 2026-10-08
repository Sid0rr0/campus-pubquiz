# 01: The Session write module takes over the queued write

**What to build:** Every change to a live session still behaves exactly as it does today, but it goes through one new Session write module instead of private methods on the game state class. The module becomes the only thing that holds the in-memory sessions. It owns:

- the per-session queue,
- the session store,
- the commit step: store the session, read standings last unless the write said it doesn't touch scores, keep the earlier leaderboard when that read fails, and report a moved auto-lock deadline on the outcome, throwing if there's no SessionOutcome to carry it.

Its interface is `write`, `read`, `has`, `list`, `place`, `remove`, `idle` and `markInitialized`, as described in the spec's Implementation Decisions.

The game state class keeps its public interface unchanged and moves onto the module:

- Every queued event hands its change to `write`. The not-touching-scores events pass the option that skips the standings read.
- Every getter reads through `read`, `has` or `list`.
- Session creation and restart restore settle through the Move committer as today, then `place` the result.
- Closing a session uses `remove`, with the existing "still in progress" refusal as its check.
- The test-only "writes idle" hook delegates to `idle`.

The held quiz edit can't move to a held writer yet (that is ticket 02). Until then it reaches the module's commit step through a temporary unqueued commit, documented as such and named so it's obviously transitional.

The module is a plain class composed inside the game state class, like the Move committer, not a Nest provider. Use a string-literal logger name, because of the `nest build` self-reference quirk noted in the game state class.

Parent spec: `.scratch/session-write-module/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The game state class no longer holds the store or the queue directly, and has no private queued-write, commit or store-with-standings methods. The deadline-report helpers and the SessionOutcome type guard live in the Session write module.
- [ ] The session store and the per-session queue are private to the Session write module. Nothing outside it can set or delete a session. The existing queue spec still passes as an internal-seam test.
- [ ] Reading an unknown join code, and reading before startup finished, fail with the same error messages as today.
- [ ] The game state class's public interface is unchanged: the gateway, controllers, Live edit module and import module need no edits.
- [ ] Every existing backend spec passes without edits, including:
  - the session-write spec,
  - the outcome-delivery specs,
  - the live-edit, quiz-edited, quiz-reimported and live-edit-delivery-failure specs,
  - the session-lifecycle-admin, sessions controller, persistence and quiz-selection, and update-session-settings specs.
- [ ] `GLOSSARY.md`'s Session write entry gains one sentence saying the module owns the store, so a session is never stored any other way. Nothing else in the entry changes.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
