# 02: Session result module, and the team page counts a tie for first as a win

**What to build:** A team that tied for first on a night sees that night counted in **Wins** on its team page (`/team` and `/teams/:id`), matching the nights won the league already gives it. Behind this, a new pure **Session result** module says what one ended session's results mean: per team, its placing, whether it left, its totals, whether it answered, its correct count, whether it won the night and whether it is the session winner; per question, its counts and correct rate; for the session, its participant count and max points. A new Standings read loads ended sessions' Standings, questions, answers and bonus awards and returns their Session results. Team history builds its rows and summary from that read.

See the spec's "The Session result module" and "Readers → Loading / Team history" sections for the full field list and rules.

Parent spec: `.scratch/session-result-module/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] The Session result module is pure, with no database or Nest dependency, and its interface is one function from one ended session's inputs to its result. It never ranks, sorts or re-sums totals: placing, ties, the winner and participation come from Standings unchanged.
- [ ] A tie for first gives `wonNight` to every tied team and `isSessionWinner` to exactly one. A team that left has no placing and never wins the night.
- [ ] A closest_guess question has no correct rate but keeps its answered and correct counts. A session with no participants has no rates.
- [ ] The Standings module has a results read for a set of ended sessions:
  - it includes a departed team's answers and bonuses;
  - it takes questions from the session's quiz;
  - it reads only ended sessions.
- [ ] Team history builds session rows and its summary from the results read. Its own correct-count query, max-points query, leaderboard/departed lookup and winning-sessions set are deleted.
- [ ] Wins counts nights where `wonNight` is true. Podiums, best placing, average placing, the share of max points and every other field are unchanged.
- [ ] Specs:
  - a pure spec on the Session result module covers each case in the spec's Testing Decisions;
  - one real-Postgres spec covers the results read;
  - the team history service case that pinned "a tie for first is not a win" is rewritten to the new rule.
- [ ] Docs, in the same change:
  - GLOSSARY.md gains **Session result**, **Night won**, **Session winner** and **Correct rate** (closest_guess has none);
  - DOCUMENTATION.md's team page win rule reads "placing 1, ties included".
- [ ] Typecheck, lint and tests pass.
