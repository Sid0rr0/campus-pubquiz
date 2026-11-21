# 01: Rename the cache to Scoring records

**What to build:** A prefactor that makes ticket 02 easy, with no change in behaviour. The session's cached answers, bonus awards and purchases are renamed to **Scoring records** everywhere:

- the session field;
- `FunFactData` and its `FunFact*` row types;
- the Standings module's read;
- the Live results read's label, so its failure log line now reads "Scoring records read failed…".

Every reader (fun facts, doubled rounds, the leaderboard board, rank callouts, the snapshot's reveal counts, the Coin ledger, the live edit, the extra-joker rebuild, stats and the frontend room-view test builder) uses the new name and computes exactly what it does today. Quiz masters, teams and the big screen see no difference. See the spec's "The Scoring records" and "Docs".

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] No source, spec or doc uses `funFactData`, `FunFactData`, `FunFactAnswer`, `FunFactBonusAward` or `FunFactPowerUp` for the cache (check with `rg -uu`)
- [ ] The failed-read log line names Scoring records, and the live results placement spec expects the new line
- [ ] The field appears in no client payload. If it does, stop and say so
- [ ] `GLOSSARY.md` has a **Scoring records** entry (_Avoid_: fun fact data), and **Live results** lists the leaderboard, the Scoring records, took part and departed teams
- [ ] `DOCUMENTATION.md` no longer says `funFactData` or "fun fact data" where it means the cache
- [ ] Every existing spec passes, changed only by the rename
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
