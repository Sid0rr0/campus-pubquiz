# 07: Comments and topics on the session stats page

**What to build:** A played session's stats page gains a Comments section, which lists every "Anything else" comment newest first with no team names, and a Topic suggestions section, which groups suggestions regardless of capitals and spaces and sorts them by how many were given ("Geography ×4"). When "Collect feedback" was off for the session, the page shows "Feedback was off for this session" instead of these sections, and the Rating column shows "—".

The session detail stats gain a feedback section: `collected` (the session's setting), `comments` (text and submitted-at only, empty comments skipped) and `topics`. Topic grouping trims, collapses inner whitespace and ignores case; each group shows its most common spelling (on a tie, the first submitted) and groups are sorted by count, then alphabetically.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 03, 04, 06

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: the stats service returns comments newest first, skipping empty ones, with no team id or name anywhere in the response.
- [ ] "Geography", " geography " and "GEOGRAPHY" count as one topic shown in its most common spelling; groups are sorted by count, then alphabetically.
- [ ] A session with the setting off reports `collected: false`.
- [ ] Stats page: the Comments and Topic suggestions sections render, and the "Feedback was off for this session" note replaces them when `collected` is false.
- [ ] Docs: `DOCUMENTATION.md`'s stats section covers comments and topics; the `/guide` page says where feedback results appear.
