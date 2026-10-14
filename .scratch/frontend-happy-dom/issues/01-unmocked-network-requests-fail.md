# 01: Unmocked network requests fail the frontend suite

**What to build:** A frontend spec that makes a network request no test has mocked fails, with an error naming the method and URL, instead of quietly reaching whatever listens on the backend address. Today the result of some `/control` specs can depend on whether a dev backend happens to be running on `:3000`; after this ticket it can't.

This is the prefactor for the happy-dom switch, done on jsdom so the switch itself starts clean. The guard lives in the shared Vitest setup and covers the global `fetch` (and any other request path the app uses, if there is one). Then every spec that trips it gets the escaping call mocked through the module it already mocks for the backend client, or asserts on the call if the request is the behaviour under test. No new mocking layer.

Where to look: a happy-dom trial on 2026-10-14 logged refused requests to the backend from these specs: `/control` previous-button, keyboard-shortcuts, end-quiz-and-close-session, join-overlay, leaderboard, rejected-actions, advance-controls, and `/display` media-rendering. jsdom swallows those failures silently, so if the guard doesn't fire for them on jsdom, find out which request path they use before closing the ticket — the guard must catch it.

Parent spec: `.scratch/frontend-happy-dom/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A spec that calls an unmocked endpoint fails with a message naming the method and URL (proved by a test of the guard itself)
- [ ] Every spec listed above passes with its backend request mocked or asserted, not reaching the network
- [ ] A full frontend run gives identical results with the dev backend stopped and with it running on `:3000`
- [ ] The full suite stays green with the same test count as before the ticket
