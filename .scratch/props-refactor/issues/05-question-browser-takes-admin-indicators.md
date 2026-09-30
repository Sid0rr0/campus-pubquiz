# 05: The /control question browser takes the admin indicators object

Parent spec: `.scratch/props-refactor/spec.md`

**What to build:** The grading panel's question browser on /control takes the admin view's indicators object (which question is on display, which round's title card or break is lit) as one prop, instead of three props renamed on the way in. The browser then speaks the Screen projection's vocabulary.

The quiz master sees the same on-display marker and round title/break indicators as today.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] The question browser takes the admin indicators object; the three renamed props are gone
- [x] /control passes the indicators straight from the admin view
- [x] Existing grading question-browsing tests pass unchanged in behaviour

## Comments

Implemented in the commit that adds this note (see git history for the hash). `QuestionBrowserPanel` takes `indicators: AdminIndicators`; /control passes the admin view straight in (a module-level all-null default covers the no-snapshot gap). Frontend (857) and backend (994) suites, typecheck and lint pass. `Status:` left as `ready-for-agent`: the triage vocabulary has no done state.
