# 01: The Session outcome carries replies, resolved team syncs and sockets to close

**What to build:** This is the prefactor that the event tickets build on. Today, outcome delivery asks the Live session module for a team's socket so it can sync that team's answers. Kick also remembers the team's socket itself and closes it in a separate after-delivery step. After this ticket, the Session outcome says all of that itself:

- **Replies** go to the sending socket before any room push.
- **Team syncs** come with each team's socket already resolved inside the module.
- **Sockets to close** are closed last, after notices.

Kick is the first caller to use "sockets to close", and the after-delivery hook stays only for re-arming timers. A refusal raised by the module (one refusal error type carrying the message teams see) becomes a socket error in the guarded event dispatcher, in one place. Nothing anyone sees changes.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Real-store gateway tests pin today's delivery order before anything moves: reply to sender, presenter context and state to rooms, admin answer lists, team syncs, notices, then socket closes.
- [ ] Outcome delivery no longer reads any team's socket from the Live session module.
- [ ] Kicking a team sends the kicked notice, then closes its socket, through the outcome alone.
- [ ] A module refusal reaches the sender as a socket error with its message unchanged; handlers no longer wrap errors themselves.
- [ ] Re-scored answers after a live key fix still sync to each connected team that answered.
