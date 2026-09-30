# 03: Delete the pass-through handlers and fix the doc comments

**What to build:** Now that every event goes through the dispatch step, delete the socket handler files that no longer earn their place. The break-end-time and display-text-scale handlers go, along with any other handler that now only makes one live-session call. Their bodies become direct live-session calls in the gateway. Handlers that still do socket-level work (joining a team's room, confirming a submitted answer to the sending socket, leaving with the socket id) are kept. The gateway's notification methods get their doc comments moved onto the methods they describe; the bonus-awards comment currently sits above the quiz-edited method. See the spec's Implementation Decisions ([spec](../spec.md)).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The break-end-time and display-text-scale handler files no longer exist, and nothing references them.
- [ ] No remaining handler file is a single live-session call.
- [ ] Each gateway doc comment sits on the method it describes.
- [ ] The break-end-time and display-text-scale specs and the concurrent-sessions specs pass unchanged in intent.
- [ ] The full backend test suite, lint and build pass.
