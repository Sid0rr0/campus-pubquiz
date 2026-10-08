# 03: The Session write module and block grading become Nest providers

**What to build:** Every live session event, press, restart restore and live edit behaves exactly as today. The Session write module and block grading are now Nest providers instead of being constructed inside the game state class. This is a prefactor so that ticket 04's Live edit module can inject both.

- The **Session write module** is injected into the game state class. Its store and queue stay private. Its interface (`write`, `hold` with the held writer, `place`, `remove`, `read`, `has`, `list`, `idle`, `markInitialized`) doesn't change. The change modules from the live-session-changes spec, wherever they exist, still don't receive it.
- **Block grading** is injected into the game state class and passed to the Move committer, instead of each constructing its own. It stays stateless, and its interface doesn't change.
- Startup ordering is unchanged. The game state class still places the seeded session and marks the Session write module initialized during its own startup, and reads before that still fail with the "used before initialization" error.
- The real-store harness builds both through the same wiring the app uses, or constructs them directly where it builds the game state class by hand.

Parent spec: `.scratch/live-edit-owns-quiz-edit/spec.md`

**Blocked by:** The session-write-module spec (tickets 01 and 02).

**Status:** done

- [x] The Session write module and block grading are registered as Nest providers. The game state class and the Move committer receive them instead of constructing them.
- [x] No module other than the game state class injects the Session write module yet.
- [x] The app boots. Restart restore places the seeded session, and a read before that still fails with the same error.
- [x] Every existing backend spec passes without assertion edits. Only harness wiring changes.
- [x] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
