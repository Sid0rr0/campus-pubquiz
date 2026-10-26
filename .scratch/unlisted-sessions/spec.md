# Spec: Unlisted sessions

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-10-26 ("add session setting - public/private sessions (public by default)"). The **Unlisted session** term in `GLOSSARY.md` was settled in that session.

## Problem Statement

Every live session appears in the big screen's "Pick a game to display" list and in the phone's "Pick the quiz" dropdown. Neither needs a login. When staff run a session that the general public shouldn't stumble into, any team opening `/play` can pick it from the dropdown and join. Examples: a rehearsal, a closed society night, or a second quiz running alongside the main one. The quiz master can't keep a session off those lists.

Phones also have no way to type a join code. The dropdown is the only picker, so a team whose camera won't scan the QR code can only join a session that is in the list.

## Solution

Sessions get a **listed** setting, on by default. An **unlisted session** is left out of the game lists teams and the big screen pick from. Staff still see it in their own session list, marked "Unlisted". Teams join it in one of two ways:

- scanning the QR code (lobby or join overlay), which prefills the code as it does today, or
- tapping "Have a game code?" on the phone's join form, which opens a "Game code" field (hidden by default), and typing the code shown on the big screen.

The big screen reaches an unlisted session through `/control`'s existing link to the display, and from then on remembers it like any other session. Once an unlisted session ends it counts like any other: in leagues, stats and team pages.

The quiz master chooses it in the start-session dialog or the lobby settings panel, with a switch called "Show in the game list". Like every other session setting, it can only change in the lobby.

## User Stories

1. As a quiz master, I want a "Show in the game list" switch when I start a session, so that I can keep a rehearsal or closed night out of the public lists from the start.
2. As a quiz master, I want the switch to be on by default, so that a normal quiz night needs no extra step.
3. As a quiz master, I want to change the switch in the lobby settings panel, so that I can fix it if I forgot at creation.
4. As a quiz master, I want the switch to stop changing once the quiz has started, so that it behaves like every other session setting.
5. As a quiz master, I want an unlisted session to show an "Unlisted" badge in the staff session list, so that I can tell at a glance which sessions teams can't find on their own.
6. As a quiz master, I want an unlisted session still listed for staff, so that I and other staff can open its control and display as usual.
7. As a quiz master, I want `/control`'s display link to open an unlisted session on the big screen, so that I can put it on the venue TV without the TV's picker.
8. As a venue big screen, I want to remember an unlisted session I was opened on, so that a reload or a dropped connection resumes it like any other session.
9. As a venue big screen, I want my picker to list only listed sessions, so that an unlisted session isn't announced on the TV to anyone walking past.
10. As a team, I want the "Pick the quiz" dropdown to list only listed sessions, so that I'm not offered a game I shouldn't join.
11. As a team, I want scanning the QR code of an unlisted session to take me straight to its join form, so that joining works the same as for any session.
12. As a team arriving from the QR code of an unlisted session, I want the "Game code" field already open with the code in it, so that I can see which game I'm joining and don't think I'm stuck on an empty dropdown.
13. As a team, I want a "Have a game code?" toggle on the join form, so that I can type the code shown on the big screen when my camera won't scan the QR code.
14. As a team, I want the code field hidden until I ask for it, so that the usual dropdown join stays uncluttered.
15. As a team, I want to type the code of a listed session too, so that I can skip scrolling the dropdown if I prefer.
16. As a team, I want a mistyped code to be refused with the usual message, so that I know to check the code on the big screen.
17. As a late team, I want the join overlay's QR code and code to work for an unlisted session, so that I can join mid-quiz like at any other night.
18. As a team, I want reconnecting to an unlisted session (saved token or team code) to work as it does today, so that a dropped phone isn't locked out.
19. As a league organiser, I want an ended unlisted session added to a league to count towards it, so that being unlisted only affects how teams find a live game.
20. As a team, I want an unlisted night I played to appear on my team page, so that my history is complete.
21. As staff, I want stored sessions created before this setting existed to be treated as listed, so that nothing running today disappears from the lists.

## Implementation Decisions

- **Setting:** `SessionSettings` gains `listed: boolean`, defaulting to `true` in `DEFAULT_SESSION_SETTINGS`. It goes through the existing paths: set at creation, validated by the partial-settings Zod schema, editable in the lobby only. Stored settings JSON without the field resolves to `true` through the existing settings default fill-in. There's no migration and no new column.
- **Session summary:** `ActiveSessionSummary` gains `listed`, filled in by the one place a held session becomes its summary. Staff need it for the badge.
- **Public listing:** `GameStateService` gets a public listing that returns only listed sessions. `GET /sessions/public` uses it, and the staff `GET /sessions` keeps listing every held session. Filtering happens on the server, so the unauthenticated endpoint never sends an unlisted session.
- **Joining is unchanged on the server:** joining by code, reconnecting and the socket rooms ignore `listed`. The join code stays the only key.
- **Join form (phone and home page):** the hidden typed "Game code" field comes back behind a "Have a game code?" toggle, closed by default. When the form's code (from `?code=`) is non-empty and not a join code in the public list, the field starts open with that code in it. The dropdown stays as it is and the field shares the form's existing code state, so whichever the team used last is what Join sends.
- **Settings UI:** the start-session dialog and the lobby settings panel show the setting as the switch "Show in the game list". The staff session list shows an "Unlisted" badge on sessions where `listed` is false.
- **Big screen:** no change. Its picker reads the public listing, and the existing `/display?code=` link from `/control` plus its remembered code already reach an unlisted session.
- **Docs, in the same change:** `DOCUMENTATION.md` (the setting in the session settings section, `/sessions/public` listing only listed sessions, the join form's code toggle), and the `/guide` page (the "Show in the game list" switch and how teams join an unlisted session). `GLOSSARY.md` already has **Unlisted session**.

## Testing Decisions

- A good test checks behaviour you can see from outside: what a listing returns, what a settings change does, what a team sees and can do on the form. It doesn't assert internal calls or component structure.
- **Backend listing:** in the `listSessions` block of `session-lifecycle-admin.spec.ts` (real `GameStateService`), add cases for the public listing: it leaves out an unlisted session and keeps a listed one, the staff listing keeps both, and the summary carries `listed`. `sessions.controller.spec.ts` checks that the public route uses the public listing and the staff route the full one.
- **Backend settings:** `session-creation-defaults.spec.ts` covers the default `true` and creating with `listed: false`. `update-session-settings.spec.ts` covers changing it in the lobby, refusal after Start like the other fields, and that a stored session without the field reads as listed.
- **Frontend join form:** `join-form.test.tsx` and `live-session-select.test.tsx` cover these cases: the code field is hidden by default, the toggle opens it, a typed code is what Join sends, and a prefilled code missing from the list opens the field with the code in it, while one in the list leaves it closed.
- **Frontend settings and staff list:** `session-settings-form.test.tsx` covers the switch's default and how it changes the settings. The session picker panel's test covers the "Unlisted" badge.
- **The shared contract:** `sessions-api.contract.test.ts` picks up the new `listed` field on the summary.
- **No new e2e journey.** The existing journeys join through `/play?code=`; run `pnpm e2e` once to confirm they still pass with the reworked join form.

## Out of Scope

- Keeping an unlisted session off public surfaces after it ends (team page, public league page, league top on the big screen).
- Any access control beyond the join code: passwords, join approval, invite lists.
- Changing the setting after the quiz has started.
- A code field on the big-screen picker.
- Pushing list changes live to open phones or pickers: they refresh as they do today.

## Further Notes

- The user-facing copy avoids "private" on purpose (see **Unlisted session** in `GLOSSARY.md`): anyone with the code can still join, so the session is unlisted, not secret.
- Being easy to reverse (a default-on flag and a list filter), this didn't get an ADR.
