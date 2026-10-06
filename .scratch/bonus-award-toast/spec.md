# Spec: Toast when a bonus award is given

Status: ready-for-agent

## Problem Statement

When the quiz master gives a team a **bonus award** (see `CONTEXT.md`), nothing visibly happens on either side.

- **The team's phone** (`/play`) quietly adds the award to the bonus drawer. A team that just did a shot or posted a selfie only finds out they got the points if they open the drawer or wait for the leaderboard. A penalty (an award with negative points) is just as quiet, so a team can lose points without noticing.
- **The quiz master's laptop** (`/control`) closes the award dialog when the server accepts the award but shows no confirmation. On a busy night, with the laptop in one hand and a moderator shouting a team name, the quiz master can't tell at a glance that the award landed on the right team. A refused award already shows an error toast; a successful one shows nothing.

There is also a small display bug in the bonus drawer: a penalty shows as "+-1 pt".

## Solution

- **On `/play`**, the team's phone pops a toast the moment a new bonus award arrives. It names the **bonus category**, the signed points, and, for a custom award, the reason the quiz master wrote, e.g. "🎉 +1 point — Selfie", "+2 points — Custom: Best team name", "−1 point — Custom: phone use". Positive awards use the success toast; penalties use a plain, neutral toast. Award toasts stay up longer than the default (about 8 seconds) so a team passing the phone around still sees it.
- **On `/control`**, once the server accepts an award, the quiz master sees a success toast naming the award and the team, e.g. "+1 Selfie → The Quizzly Bears". A refusal keeps its existing error toast and the dialog stays open, unchanged.
- **The bonus drawer** shows signed points ("+1 pt", "−1 pt"), using the same formatting as the toasts.

Only a freshly given award toasts. Awards a phone gets back when it reconnects, and later edits or deletions of an award, don't.

## User Stories

1. As a team, I want my phone to show a toast when the quiz master gives us a bonus award, so that we know right away our shot or selfie counted.
2. As a team, I want the toast to name the bonus category, so that we know what the points were for.
3. As a team, I want the toast to show how many points we got, so that we can follow our score without opening the leaderboard.
4. As a team, I want a custom award's toast to include the reason the quiz master wrote, so that "Custom" isn't a mystery.
5. As a team, I want a penalty to toast too, showing the negative points, so that we find out we lost points when it happens rather than from the leaderboard.
6. As a team, I want a penalty's toast to look neutral rather than celebratory, so that losing points doesn't arrive with a party popper.
7. As a team, I want the toast to stay up long enough to read while we pass the phone around, so that we don't miss it.
8. As a team, I want each award to toast separately when two arrive close together, so that we see both.
9. As a team, I don't want my phone to replay toasts for old awards when it wakes up or reconnects, so that we aren't spammed with things we've already seen.
10. As a team whose phone was asleep when an award was given, I want the award to still be in the bonus drawer, so that I can check it there.
11. As a team, I don't want a toast when the quiz master corrects or removes an earlier award, so that typo fixes don't cause a fuss.
12. As a team, I want the bonus drawer to show a penalty as "−1 pt" rather than "+-1 pt", so that the list reads correctly.
13. As a team, I want the drawer and the toast to format points the same way, so that the two never disagree.
14. As a team, I want half-point awards to show as "+0.5", so that a half award reads as what it is.
15. As a quiz master, I want a confirmation toast when an award I gave is accepted, so that I know it went through without checking the team's drawer.
16. As a quiz master, I want the confirmation to name the team, so that I can catch giving the award to the wrong team right away.
17. As a quiz master, I want the confirmation to show the category and signed points, so that I can catch a typo in the points.
18. As a quiz master, I want a refused award to keep showing only its error toast, with the dialog left open, so that I can fix and resend it.
19. As a quiz master, I want the confirmation even when the team's phone is offline, so that my feedback doesn't depend on their connection.
20. As a quiz master, I want other admin actions (grading, advancing, kicking) to stay as quiet as they are now, so that toasts keep their meaning.

## Implementation Decisions

- **No backend or protocol change.** The team-only `BONUS_AWARDED` notice already carries the team-facing award view (`category`, `points`, and `reason` for custom awards), and the server only sends it for a freshly given award to a connected team's socket. Edits and deletions don't send any team notice, and `JOIN_ACCEPTED` restores the full award list without one, so "only live awards toast" falls out of the existing protocol.
- **The player hook raises the team toast.** `usePlayerGame` already toasts rejections directly via `sonner`. Its `BONUS_AWARDED` handler, which already appends to `myBonusAwards`, will also call the toast: `toast.success` for positive points and plain `toast` for negative points, with an 8-second duration. The `JOIN_ACCEPTED` restore path is not touched.
- **The award form's success branch raises the quiz master's confirmation.** That's where the award dialog already closes on an accepted result, and it knows the team name. The shared admin `emitAction` helper doesn't change, so no other admin action starts toasting on success.
- **One signed-points formatter**, shared by the team toast, the quiz master's confirmation and the bonus drawer. It renders "+1", "−1" (a real minus sign) and "+0.5". It lives with the other bonus display helpers (next to the category labels).
- **Toast text** uses the existing category labels. The custom reason comes after a colon. The words "point"/"points" are pluralised by value on the team toast. The confirmation uses the compact form "<signed points> <category label> → <team name>".
- **Position and look** stay as the global Toaster sets them (bottom right, brand success colours). The implementer checks in the browser that an award toast doesn't cover `/play`'s bottom actions bar, and only adjusts if it does.
- **Docs in the same commit:** the bonus points section of `DOCUMENTATION.md` (teams are toasted on a new award; the quiz master gets a confirmation), and the `/guide` page for the new `/control` confirmation. The glossary terms **Bonus award** and **Bonus category** are already in `CONTEXT.md`.

## Testing Decisions

- Good tests here assert what the people using the app see: which toast appears, with what text and in what style, given what the server sent. They don't assert how the hook stores state or which internal helper did the formatting. `sonner` is mocked at the module boundary, as the existing tests already do.
- **`/play` seam: `usePlayerGame` driven by the fake socket** (prior art: the existing `use-player-game` hook tests, which already mock `sonner`):
  - A live `BONUS_AWARDED` with positive points raises one success toast with category and points.
  - A custom award's toast includes the reason.
  - A penalty raises a plain (non-success) toast with negative points.
  - Awards restored via `JOIN_ACCEPTED` raise no toast.
- **`/control` seam: the full admin page with the real admin hook and the fake socket** (prior art: the rejected-actions page tests):
  - Giving a bonus that the server accepts raises the confirmation toast naming the team, category and signed points.
  - A refused award raises only the existing error toast, and the dialog stays open.
- **Bonus drawer seam: the play page with a mocked player hook** (prior art: the bonus-progress page tests):
  - A penalty in `myBonusAwards` displays as "−1 pt".
- The signed-points formatter is covered through these seams and gets no separate test.

## Out of Scope

- Showing bonus awards publicly on `/display`, which would mean broadcasting awards to every room. That's a separate feature.
- Toasting edits or deletions of an award, or telling a connected phone about them live (today the drawer only picks them up on the next rejoin).
- Replaying missed awards as toasts after a reconnect.
- A "View" action on the toast that opens the bonus drawer.
- Success toasts for any other admin action.
- Any change to bonus categories, limits or the earning deadline.

## Further Notes

- A team whose phone isn't connected when the award is given gets no `BONUS_AWARDED` notice, so it gets no toast. The award still appears in the drawer after rejoin, which matches the decision not to replay toasts.
- The drawer's "+-1 pt" bug predates this feature. It's fixed here because the toast needs the same signed formatting anyway.
