# 04: Shared admin-session connection hook; /remote moves to the admin game hook

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** /control and /remote connect to a session through one admin-session connection hook, so a fix made for one reaches both. The hook takes the page's route, returns the admin game hook's result, and owns:

- the auth gate (loading, then a redirect to login when unauthenticated or pending);
- adopting the URL's session code only when it differs from the connected session (no pointless reconnect);
- keeping the URL in sync with the connected session;
- redirecting to the session picker when there is no code;
- redirecting to the session picker when the socket was refused before any snapshot arrived.

/remote now runs on the admin game hook. A rejected Advance on the remote shows its reason as a toast, and the remote's connection banner shows only real connection problems. /remote's copied logic and its "mirrors /control" comment are deleted.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] /control and /remote both use the shared admin-session connection hook, and neither page keeps its own copy of the connect, URL or auth logic
- [ ] /remote page tests mock the admin hook, and each redirect behaviour /control tests (never-connected code goes to the picker, a rejected action on a live session stays put, URL sync, login redirect, no code goes to the picker) also has a /remote test
- [ ] A rejected Advance on /remote shows a toast, not the connection banner
- [ ] Following a link to the session /remote is already connected to does not force a reconnect
