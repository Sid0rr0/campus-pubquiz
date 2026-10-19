# 03: A portrait question image fits the screen

**What to build:** On `/display`, a question whose image is portrait (the two-column layout) shows the image capped to the space between the header and the "X OF Y TEAMS ANSWERED" line, whatever its natural size — it never runs over the header or off the bottom. The 50/50 prompt/image split stays. Fullscreen media (spacebar) is unchanged.

Parent spec: `.scratch/display-portrait-margin/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] A tall portrait image (e.g. 1000×3000) with a long prompt stays below the header and above the teams-answered line, checked by hand on the running app (:8888 `/display`) — happy-dom can't verify layout.
- [ ] The same holds at reveal and in break review.
- [x] Landscape images, video and fullscreen look as before.
- [x] Existing question-display tests pass.
