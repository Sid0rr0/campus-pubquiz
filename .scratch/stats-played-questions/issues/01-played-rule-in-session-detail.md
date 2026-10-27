# 01: Move the played-question rule into the session detail

**What to build:** A prefactor with no visible change. The session detail decides which questions an ended session played, and the Night brief reads that answer instead of working it out itself. The shared session-rows loader, used by both the stats page and the Night brief, reads the session's stored opened question ids. The session detail input carries them, null for a session saved before they were tracked. The rule moves unchanged from the Night brief into the session detail module: a question is played when the session opened it or it has a stored answer, and for a null list it's every question up to the last answered one, in play order. The brief's own rule and its separate opened-ids query are deleted. Stats page figures and Night brief text stay exactly as they are today. See the spec's Implementation Decisions for the options for how the brief reads "played" without a second rule.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The session detail input carries the session's opened question ids (nullable), and the Night brief input gets them through it, not as its own field
- [ ] The shared session-rows loader reads the opened question ids, and the Night brief no longer queries them separately
- [ ] There is exactly one played-question rule, in the session detail module; the Night brief has none of its own
- [ ] The public session detail stats shape is unchanged
- [ ] Every existing session detail calc, session brief calc and stats service spec passes unchanged (fixtures may gain the new input field)
