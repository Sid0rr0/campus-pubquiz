# 01: The admin view carries control availability, and /control and /remote render it

**What to build:** the admin view tells `/control` and `/remote` what the quiz master can do right now: start, end, close the session, toggle the join overlay, replay media, pause media, whether answer status is shown, and the teams tied for first. Both pages render that and no longer work out game facts themselves. The media controls follow exactly what the big screen is playing, read from the same Display screen `/display` is sent. So on a closest_guess reveal, "Play again" and Pause/Resume now appear once its answer video or audio is on screen, and not before. Everything else the quiz master sees stays the same.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One shared function returns the media the big screen is playing, from the Display screen: the open question's own media, or on a reveal screen the answer media (replacing the question's own), else the question's own. Screens that show no question play nothing
- [ ] The pausable-media check lives in shared types beside the media classifier, and the display code imports it from there
- [ ] The admin room's view has a control-availability field with the same fields as today's client admin controls. The Screen projection builds it for the admin room only, beside the admin indicators. It reads playing media from the same Display screen the display room gets, without sending that screen to the admin room
- [ ] `/control` and `/remote` read control availability from the view. The client admin-controls module and its playing-media copy are deleted. Space for pause keeps its gate, now read from the view
- [ ] A projection spec for the admin room (built sessions, like the admin-flags projection spec) covers: status-based fields in lobby, running and ended, and the join-overlay-allowed statuses; an open question with YouTube, uploaded video, audio, image and no media; a reveal with answer media, without answer media, and with image media; a closest_guess reveal before and after the walk reaches its answer media; locking, break review, a title card, and under the leaderboard and join overlay; answer status only while a question is on air; tied-for-first names at a tie
- [ ] `/control` and `/remote` page tests set control availability through the shared admin-view fixture builder; the client admin-controls unit tests are deleted
- [ ] The `/guide` page says Pause and "Play again" are offered on a closest_guess reveal once its answer media is on screen
