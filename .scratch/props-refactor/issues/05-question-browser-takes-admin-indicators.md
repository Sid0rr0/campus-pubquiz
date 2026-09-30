# 05: The /control question browser takes the admin indicators object

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The grading panel's question browser on /control takes the admin view's indicators object (which question is on display, which round's title card or break is lit) as one prop, instead of three props renamed on the way in. The browser then speaks the Screen projection's vocabulary.

The quiz master sees the same on-display marker and round title/break indicators as today.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The question browser takes the admin indicators object; the three renamed props are gone
- [ ] /control passes the indicators straight from the admin view
- [ ] Existing grading question-browsing tests pass unchanged in behaviour
