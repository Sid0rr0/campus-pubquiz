# 02: Acknowledgements only report, and feedback writes send a team view

**What to build:** A round rating, a feedback send or a session rating made on one phone now shows on the team's other phones: the team feedback change module lists the rating team as changed, so the delivery step sends that team a fresh team view. The team view now reaches the team's phones after every change, so the phone's own "just saved" patches go. The round rating, feedback, session rating, player count and joker pick acknowledgements just return their result, and their five reducer actions are deleted. The **answer-received** reply is removed from the socket protocol (event, payload type, server reply case, phone listener and reducer action): the submitting team already gets a team view, sent right after the replies, on every answer submit. The submit acknowledgement still settles the pending answer. See the spec's "Acknowledgements report, they don't write" and "Feedback writes send a team view".

**Blocked by:** 01 (without it, every feedback team view would remount the rating card after each tap)

**Status:** ready-for-agent

- [ ] Live equals resync holds after a round rating, a feedback send and a session rating (backend socket specs, real Postgres)
- [ ] A feedback team view reaches only the rating team's sockets
- [ ] Answer submit specs check the team view the submitter's socket receives in place of answer-received; the pending answer still survives a team view arriving before its acknowledgement
- [ ] The five saved reducer actions and answer-received are gone from the protocol, server and phone, and their tests are deleted
- [ ] Joker notices still fire for a drawn or moved joker and not for a chosen one
- [ ] `DOCUMENTATION.md`: answer-received is out of the server-to-client event list; the submitting team's saved answer and feedback writes are described as reaching the phones through the team view
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
