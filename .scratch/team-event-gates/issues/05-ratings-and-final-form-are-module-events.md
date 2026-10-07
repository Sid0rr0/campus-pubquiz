# 05: Round ratings and the final form become Live session module events

**What to build:** A round rating sent just as the break ends, or final feedback sent just as the form closes, is either saved or refused. Feedback is never stored after its window closed. Today the rate-round and send-feedback socket handlers hold these rules themselves and check them against the stored session outside any write.

"Round rated" and "feedback sent" become event methods of the Live session module. Each one checks which team the socket belongs to, whether feedback is collected, and whether the round or the final form is open, against the session its write holds. It then stores the rating or feedback inside that write. Both writes are declared as not touching scores and produce no broadcast. Their socket handlers become plain dispatch like the others. The getters that only those handlers used (team for a socket, whether feedback is collected, round open for rating, final form open) are removed if nothing else uses them. Refusal messages are unchanged.

Parent spec: `.scratch/team-event-gates/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A round rating sent while the press out of the break is held is refused with "This round can't be rated right now", and nothing is stored.
- [ ] A rating sent first, held on its store while the press goes ahead, is saved and shows on the session stats.
- [ ] Final feedback sent outside the final form is refused, checked inside the write.
- [ ] `rate-round.spec.ts`, `send-feedback.spec.ts` and `collect-feedback-setting.spec.ts` pass unchanged.
