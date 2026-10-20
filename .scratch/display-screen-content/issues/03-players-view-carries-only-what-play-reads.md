# 03: Phones are sent only what /play reads

**What to build:** Every phone stops receiving fields it never reads:

- the big screen's text scale and sound mute;
- the break end time;
- which teams have answered the current question;
- every round title.

These move from the shared snapshot into the display and admin views, so the big screen, `/control` and `/remote` keep working exactly as today. The closest-guess reveal step leaves every view: no page reads it, and the reveal questions are already trimmed to it on the server. Each room's view then carries only what that room reads, as the coding standards require. Updates to phones get smaller and nothing on any screen changes.

Parent spec: `.scratch/display-screen-content/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The shared snapshot no longer carries text scale, sound mute, break end time, answered team ids or round titles. The display and admin views carry the ones each reads.
- [x] No room view carries the closest-guess reveal step. The projection still trims reveal questions with it.
- [x] The players view type has none of the moved fields, so a `/play` read of one fails typecheck.
- [x] Screen projection specs check that the players view carries none of the moved fields and that no view carries the closest-guess reveal step.
- [x] The room-view fixtures follow the projection, and display, control and remote tests pass with fixture updates only.
- [x] DOCUMENTATION.md's protocol section lists the moved fields under the display and admin views, not the players view.
- [x] Typecheck, lint and tests pass.
