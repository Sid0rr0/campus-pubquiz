# 02: Stats session detail reads the night through the night read

**What to build:** the stats session detail reads its questions and every team's answers from the night read instead of its own SQL and wording map. A quiz master sees the same stats page as today: the same worded Answer keys and team answers, the same Scoresheet rows and columns (kicked and departed teams included), and the same correct rates, answered counts, fastest responses and highlights.

**Blocked by:** 01 (Night read on the Ended-sessions read, used by the Team page)

**Status:** done

- [ ] The stats session detail no longer queries questions or answers itself and no longer builds its own wording map; it passes the night read's questions and answers (unnarrowed) into the session-detail calc
- [ ] The night read itself is not changed by this ticket
- [ ] Rounds (titles, categories, ratings), feedback, bonus awards, Standings and player counts are still loaded as before, so rounds with no questions still get a row
- [ ] The calc's input rows are mapped from, or narrowed to, the night read's types; its figures are unchanged
- [ ] The stats service spec passes with no assertion changed, including the wiring case, the wording case and the kicked-team correct-rate case; fixtures made redundant by the night read's spec may be trimmed
- [ ] `SessionDetailStats` keeps its shape; the Scoresheet still works out its "Round N" headers on the frontend
