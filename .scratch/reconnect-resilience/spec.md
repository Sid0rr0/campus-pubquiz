# Spec: The big screen and the phones survive a dropped connection

Status: ready-for-agent

Blocked by: —

## Problem Statement

Two failures from live quiz nights:

- **The big screen loses its session.** When the venue network hiccups, the `/display` page drops back to "Pick a game to display". The quiz master has to walk to the TV laptop and pick the session again, while the room looks at a menu.
- **Phones go quietly stale.** A player locks their phone or switches apps, comes back, and the phone still shows an old screen. When they try to submit, "nothing happens". They don't know they need to refresh. Once, after a reconnect, a team kept getting "You may only submit answers for your own team", and the quiz master had to kick the team so it could rejoin.

## Causes found so far

- `/display` treats *any* `connectionError` as a dead session code ([display/page.tsx](../../apps/frontend/app/display/page.tsx), the effect that `router.replace('/display')`). This includes the transient "Connection lost — reconnecting…" message. The page strips `?code=`, unmounts the socket and shows the picker, so socket.io never reconnects. The only real refusal is the server disconnecting the socket after "Unknown game session code" (`io server disconnect`), from `connection.util.ts`.
- Phones have no handler for coming back to the page: nothing listens for `visibilitychange`, `pageshow` or `online`. Mobile OSes freeze the socket in the background. On return, the socket still reports `connected` until ping detection gives up, which can take tens of seconds. An answer sent in that window waits out the full 10 s ack timeout before the phone reacts.
- The "own team" refusal means the socket that sent the answer isn't the one holding the team's seat (`connectedTeamSockets`). The server's seat handover looks right, so the phone probably believes it is linked when the server disagrees. This is not reproduced yet: see ticket 04.

## Solution

- The big screen keeps its session and its last frame through a drop. It shows a small "Reconnecting…" badge and resyncs on its own. It goes back to the picker only when the server refuses the code. It also remembers the last code it showed, so a reload or a bare `/display` resumes it.
- Phones reconnect and resync whenever the player comes back: the tab becomes visible, the page is restored from the back/forward cache, or the network comes back.
- While a phone is reconnecting it shows an obvious full-width bar. If that takes longer than 10 s, the bar offers "Tap to reconnect".
- The "own team" refusal is reproduced, fixed, and covered by a regression test.

## User Stories

1. As a quiz master, I want the big screen to ride out a network blip without me touching it, so that the room never sees the session picker mid-quiz.
2. As a quiz master, I want the big screen to keep showing the current question while it reconnects, so that teams can keep reading it.
3. As a quiz master, I want a small, unobtrusive "Reconnecting…" badge on the big screen, so that I can tell why it isn't moving.
4. As a quiz master, I want the big screen to return to the picker when its session has really ended or the code is unknown, so that a stale QR still lands somewhere sensible.
5. As a quiz master, I want reloading the big screen, or opening `/display` on it again, to resume the session it last showed, so that I don't have to pick it.
6. As a player, I want my phone to catch up as soon as I unlock it or switch back to the browser, so that I see the question the big screen is on.
7. As a player, I want a hard-to-miss bar when my phone isn't connected, so that I know my answer can't get through.
8. As a player, I want a "Tap to reconnect" button when reconnecting takes a while, so that I can fix it without knowing to refresh.
9. As a player, I want my answer to go through after my phone reconnects, without anyone kicking my team.

## Implementation Decisions

- `useGameConnection` exposes why it isn't connected: `reconnecting` (socket.io is retrying) or `refused` (`io server disconnect`). Callers stop matching on message strings. `connectionError` stays as the text to show.
- `/display` goes back to the picker only on `refused`. On `reconnecting` it keeps rendering the last snapshot with a corner badge.
- The last display code is stored in localStorage on the display device, with every access wrapped in try/catch. `/display` without `?code=` tries the stored code first and falls back to the picker if the server refuses it. The picker stays reachable from a small "Pick another game" link on the lobby screen.
- Phones: when the page becomes visible after being hidden for at least `HIDDEN_RECONNECT_THRESHOLD_MS` (5 s), on `pageshow` with `persisted`, and on `online`, the phone calls `forceReconnect`. The rejoin goes through the existing join path, so `previousSocketId` hands the seat over.
- The reconnecting bar replaces the inline magenta text on `/play`. It is fixed to the top and full width, and after `RECONNECT_HELP_DELAY_MS` (10 s) it adds a "Tap to reconnect" button that calls `forceReconnect`.
- No server protocol change, except whatever ticket 04's fix needs.

## Testing Decisions

- `useGameConnection`: a transient disconnect yields `reconnecting` and keeps the snapshot; `io server disconnect` yields `refused`.
- `/display`: `reconnecting` keeps the screen and shows the badge; `refused` shows the picker; a stored code is resumed.
- Phones: the visibility, `pageshow` and `online` triggers call `forceReconnect` (fake timers for the threshold), and the bar and the delayed button render.
- An e2e journey in `e2e/` for a big screen that loses its connection and comes back, if Playwright can drop the socket reliably (`context.setOffline`).

## Out of Scope

- Changing socket.io's ping interval or timeout.
- Offline answer queueing beyond what the team link already does.
