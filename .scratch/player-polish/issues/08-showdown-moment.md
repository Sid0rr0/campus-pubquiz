# 08: Showdown — spotlight, guesses slam in, "Your turn!"

**What to build:** Spec: `.scratch/player-polish/spec.md`, "Showdown". The big screen spotlights the team whose seat is up; each guess slams in with a sound when revealed; the winner gets a burst. The phone of the team in turn vibrates and shows "Your turn!"; other phones show "Tiebreaker in progress" with a subtle pulse. The showdown's steps are unchanged.

**Blocked by:** 01

**Status:** done

- [x] "Your turn!" and vibration only on the phone whose team is in turn (Vitest, test first)
- [x] No vibration or slam sound on reconnect or Previous
- [x] Winner burst respects reduced motion

## Comments

- "In turn" on the phone means the team is a showdown participant that has not guessed yet; the buzz fires when that becomes true live. On the big screen the spotlight is the seat whose guess was just revealed; the winner takes it once the answer shows.
- The winner burst is a transform/opacity ring built with `motion` (fade only under reduced motion), not `canvas-confetti`, which is not installed in the worktree. Sounds `slam` and `burst` are the registry names; the files are still for a human to add.
- Docs: no `DOCUMENTATION.md`/`/guide` change; statuses and the `/control` flow are unchanged.
