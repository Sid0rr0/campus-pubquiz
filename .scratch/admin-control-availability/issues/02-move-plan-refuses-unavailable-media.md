# 02: The Move plan refuses unavailable media actions

**What to build:** the server agrees with the buttons. A "Play again" press while nothing replayable is on the big screen, or a Pause press while nothing pausable is, is refused like any other illegal move: the session doesn't change, nothing is broadcast, and a stale `/remote` tab can't leave the paused flag set for the next question. Whenever media is playing, replay and pause work exactly as today.

**Blocked by:** 01 (The admin view carries control availability, and /control and /remote render it)

**Status:** ready-for-agent

- [ ] Planning `REPLAY_MEDIA` when nothing replayable is playing, or `TOGGLE_MEDIA_PAUSE` when nothing pausable is, returns a blocked move with an illegal-transition cause, using the playing-media rule from 01 (not a second copy)
- [ ] Commit a move refuses such a press as it does any blocked move. Progress is unchanged and nothing is broadcast
- [ ] `TOGGLE_MEDIA_FULLSCREEN` is unchanged
- [ ] The admin-actions spec (real game state) covers a refused replay and a refused pause while nothing is playing, and its existing replay and pause cases pass unchanged
- [ ] The `DOCUMENTATION.md` actions table lists `REPLAY_MEDIA` and `TOGGLE_MEDIA_PAUSE` as allowed only while media is playing
