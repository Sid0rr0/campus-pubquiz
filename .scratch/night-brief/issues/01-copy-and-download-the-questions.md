# 01: Copy or download a brief of an ended session's questions

**What to build:** the tracer bullet, end to end. `GET /stats/sessions/:id/brief` (stats guards, `text/markdown`, 404 for a running or unknown session, 400 for a non-numeric id) returns a Markdown brief built by one pure calc beside the session detail calc. This slice includes:

- **Session header:** name, date, team count.
- **Each round:** number, title, category, author, round note, kahoot flag.
- **Each question:** number, type, prompt, answer (`formatAnswer`), points, notes (`questionNotesOf`), a media flag (never the URL), and answered, correct and partial counts plus the correct rate from the Question outcome module, with the same team count as the session detail.
- **On `/stats/:id`:** the "Night brief" control with **Copy** (clipboard plus "Copied" toast, error toast on failure) and **Download** (`night-brief-<slug>-<YYYY-MM-DD>.md`).

Parent spec: `.scratch/night-brief/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Pure calc tests: rounds and questions rendered with answer, notes, media flag and counts; `closest_guess` shows no correct rate; author line absent when the round has none; no team name, code or id in the output
- [ ] One case: figures equal `computeSessionDetail`'s for the same rows
- [ ] Postgres test via the stats service: ended session → brief; running or unknown → 404
- [ ] Controller spec: admin and moderator allowed; non-numeric id → 400
- [ ] Frontend panel test: Copy writes the fetched text and toasts; Download saves the expected filename
- [ ] `DOCUMENTATION.md`: "Night brief" subsection under Session Stats
