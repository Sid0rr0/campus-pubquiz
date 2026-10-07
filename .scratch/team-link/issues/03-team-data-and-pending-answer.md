# 03: Team data and the pending answer move into the Team link; the player hook is retired

**What to build:** A reconnecting phone always shows exactly what the server has for its team, and an answer sent just as the connection died still counts.

The team's own data:

- **Join accepted** restores the team's answers, grades, bonus awards, round ratings and feedback wholesale, and bumps the ratings epoch.
- **Answer received** updates just that answer, plus its grade when it was graded automatically.
- **Team answers synced** (at the reveal) replaces answers and grades.
- **Bonus awarded live** is appended and toasted. Awards restored on join aren't toasted.
- **A rating or feedback the server acknowledged** stays shown after a reconnect. A tap that never reached the server doesn't.
- **A new connection identity** clears the previous team's data until the new join answers.

The pending answer:

- Submitting while linked sends the answer and arms the confirmation timer for that attempt. A later submit supersedes it.
- If the answer was never delivered, it stays pending without forcing a reconnect.
- A timeout unlinks the phone and forces a reconnect.
- An acknowledgement clears it. A refusal ("Answers are locked for this question") also toasts and is never resent.
- Results for older attempts are ignored.
- Join accepted resends whatever is still pending.
- Submitting while not linked toasts "not connected" and sends nothing.

All of this moves into the Team link module. The new events are answer received, team answers synced, bonus awarded, the answer results and timeout with their attempt, and rating and feedback saved. The new intent is submitting an answer. The new commands are send an answer, arm or clear the confirmation timer, force a reconnect, and toast.

The player hook folds into the adapter and is deleted. The adapter runs the confirmation timer with the existing constant and feeds its expiry back in as an event. Seen questions stay outside the module: the adapter keeps feeding room state to the existing pure merge. The rules page, which never joins a team, gets a snapshot-only players connection on the connection core.

The `/play` and join-panel test files switch their mock from the player hook to the adapter, with the same result shape. `docs/architecture.md`'s frontend diagram replaces the join hook and player hook with the Team link module and its adapter.

Parent spec: `.scratch/team-link/spec.md`

**Blocked by:** 01 (Joins go through the Team link)

**Status:** ready-for-agent

- [ ] Module event-sequence tests, written first:
  - each of the team-data rules above;
  - answer submitted, connection drops, reconnects, join accepted → the answer is resent exactly once;
  - supersede;
  - not delivered keeps the answer pending with no reconnect;
  - timeout → unlinked plus force reconnect;
  - refusal → toast, no resend;
  - a stale acknowledgement doesn't clear a newer pending answer;
  - submitting while unlinked → toast, no send;
  - a new identity clears team data.
- [ ] Adapter tests on the fake socket: socket events reach the module; an answer send emits and arms the timer; the timer firing forces a reconnect; a bonus award toasts.
- [ ] The player hook is gone; no page or test imports it. The rules page renders from its snapshot-only connection.
- [ ] All `/play`, join-panel, home-page and rules page tests pass against the adapter mock.
- [ ] `docs/architecture.md`'s frontend diagram is updated.
- [ ] `pnpm --filter frontend test`, `pnpm lint`, `pnpm typecheck` and `pnpm build` pass.
