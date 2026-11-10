# 02: Block screens draw their Display screen directly: open question, break intro, break review

**What to build:** The open question, break intro and break review screens take the shared screen-view props that ticket 01 exported, including the live media flags, and read what they need. Their pass-through adapters and duplicate props interfaces are deleted, and the screen-kind table points at them directly. With this ticket, the seven pass-through adapters the spec names are all gone. Teams in the room see the same open question (answered count, quickfire countdown, media), break intro (round, break number, bonus list, feedback prompt, fun facts) and break review (question and media) as before.

- Behaviour the adapters carried moves into the screens unchanged: the open question's answered count is present only with a live context; break intro shows the bonus list unless it is the final break; the media flags and autoplay setting reach the media players as before.
- The question display and other shared sub-components keep their own props.

No `/guide` or docs text.

**Blocked by:** 01 (Session screens draw their Display screen directly), which exports the shared props and edits the same view file and test suite.

**Status:** ready-for-agent

- [ ] The three screens take the shared screen-view props; their adapters and props interfaces no longer exist
- [ ] The break fun-facts test and the hidden-video tests for the open question and break review render through the Display screen view from a Display screen fixture, with their assertions unchanged
- [ ] A live-context case for the open question shows its answered count; a final-break case shows break intro without the bonus list
- [ ] The existing Display screen view suite passes unchanged
- [ ] `pnpm typecheck`, the frontend tests and `pnpm crap:changed` pass (if a screen goes over 10, extract a sub-component with plain props inside its file rather than restoring an adapter)
