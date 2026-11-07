# Spec: one shared Quiz mode module: what a quickfire quiz turns off

Status: ready-for-agent

Blocked by: `power-up-offer` (only the last step, deleting the purchase path's quickfire gate, which that spec moves into the Power-up offer module)

Source: architecture review 2026-11-07, candidate 4 ("A shared Quiz mode module: what quickfire turns off").

## Problem Statement

A quiz's mode (ADR 0005) decides which session features exist: a quickfire quiz has no jokers, no power-ups, no coins and no leagues, and only it has the quickfire question timer. That list is written out by hand in several places across both apps:

- the backend's settings refusal, a chain of `if`s for jokers, power-ups, starting coins and leagues, used by session creation and the lobby's settings save
- separate quickfire checks in league assignment and coin awards, each with its own message
- the frontend's "send no coin settings" helper, and around a dozen `isQuickfire` branches in the start-session dialog, the lobby's settings panel and the settings form that hide the joker switch, the power-ups tab, the coin fields and the league picker, or show the question timer
- the `/control` lobby, which asks the session question "is this a quickfire quiz?" through the snapshot's round flag for the current round (round 0 in the lobby), because the snapshot doesn't carry the mode

If the backend and `/control` drift (a new pub-only setting hidden on one side but not refused on the other), a quiz master can save a setting the server then refuses, or the server accepts a setting the dialog never showed.

Separately, per-round quickfire gates are still in the power-up code: the purchase path refuses question power-ups in a quickfire round, the extra joker's next-round rule skips a quickfire round, and the live-edit rebuild refunds an extra joker whose round "became" quickfire. Under ADR 0005 every round of a session shares the quiz's mode and a live edit can't change it, so these gates are meant to be dead. One hole stops them being dead today: the migration that moved the mode onto the quiz didn't touch stored session settings, so a session stored before it, for a quiz that is now quickfire, can still load with jokers or power-ups switched on.

## Solution

One shared **Quiz mode** module in shared types says what each mode allows. It also derives the settings refusal, the settings a client sends, and the session settings a mode actually plays with. The backend refuses through it, `/control` shows and sends settings through it, and the snapshot carries the quiz mode so the lobby asks the right question. The game engine keeps its per-round quickfire flag for the block, reveal and timer logic, as ADR 0005 says.

The backend applies the mode to a session's settings whenever it loads the game (creation and restore), so a quickfire session always plays with jokers, power-ups and coins off, whatever an older stored row says. That makes the per-round gates in the power-up code truly dead, and they're deleted.

The quiz master, teams and big screen see nothing new: the same settings are shown, hidden and refused with the same messages. The one fix: a quickfire session stored before the mode migration no longer offers a joker pick or power-ups if it's restored.

## User Stories

1. As a quiz master starting a quickfire quiz, I want the start-session dialog to hide the joker switch, the power-ups settings, the coin fields and the league picker, so that I'm not offered settings the quiz can't use.
2. As a quiz master starting a quickfire quiz, I want the dialog to show the quickfire question timer with its default filled in, so that I can set how long each question stays open.
3. As a quiz master starting a pub quiz, I want the dialog to show jokers, power-ups, coins and leagues and hide the quickfire question timer, so that I get the pub quiz settings.
4. As a quiz master starting a quickfire quiz, I want the dialog to send no coin settings, so that the server doesn't refuse my session over defaults I never touched.
5. As a quiz master in the lobby of a quickfire session, I want the settings panel to show the same quickfire settings the start dialog showed, so that the two screens agree.
6. As a quiz master in the lobby of a quickfire session, I want the settings panel to know the session is quickfire from the quiz's mode, not from whichever round the lobby happens to point at, so that it's right even if the engine's per-round flag changes shape.
7. As a quiz master in the lobby of a quickfire session, I want Save to send no coin settings and no leagues, so that saving never trips a refusal.
8. As a quiz master in the lobby of a quickfire session, I want no power-ups tab, so that the panel only has tabs that do something.
9. As a quiz master, I want the server to refuse jokers on a quickfire session with "A quickfire session can't have jokers", so that a crafted request can't switch them on.
10. As a quiz master, I want the server to refuse power-ups on a quickfire session with "A quickfire session can't have power-ups".
11. As a quiz master, I want the server to refuse starting coins on a quickfire session with "A quickfire session has no coins, so it can't have starting coins".
12. As a quiz master, I want the server to refuse adding a quickfire session to a league with "A quickfire session can't be added to a league", whether at creation, from the lobby or from the league page.
13. As a quiz master, I want the server to refuse a coin award in a quickfire session with "A quickfire session has no coins, so it can't award any", while still allowing a points-only bonus award.
14. As a quiz master, I want a settings patch that only names unrelated settings (round overview, feedback, fun facts, timer) accepted on a quickfire session, so that a stored value never blocks an unrelated edit.
15. As a quiz master restoring a quickfire session stored before the quiz-mode migration, I want it to come back with jokers, power-ups and coins off, so that a stale setting doesn't open a joker pick or a power-ups list in a quickfire quiz.
16. As a team in a quickfire session, I want no power-ups, no coins and no joker pick on my phone, so that the speed round stays a speed round.
17. As a team in a pub quiz session, I want jokers, power-ups and coins exactly as the quiz master set them, so that nothing about pub quizzes changes.
18. As a quiz master, I want the running-sessions list to mark quickfire sessions as it does today, so that I can tell them apart.
19. As a developer adding a new pub-only setting, I want to add it to one table in one module and have the server's refusal, the outgoing settings and the `/control` forms all follow, so that the two apps can't drift.
20. As a developer, I want one table test per mode that states what it allows, so that the rules are readable at a glance.
21. As a developer, I want the dead per-round quickfire gates in the power-up code deleted, so that nobody keeps a rule alive that can't fire.
22. As a developer, I want the engine's per-round quickfire flag left alone, so that the block, reveal and timer logic doesn't change (ADR 0005).
23. As a developer, I want the allowed question types for a quickfire quiz to stay with the question type registry (ADR 0001), so that the editor and import keep checking them where they do now.

## Implementation Decisions

- **The Quiz mode module lives in shared types**, beside the existing quiz mode list, so the backend and `/control` import the same rules. It states, per mode, what the mode allows:

  | allows                   | pub | quickfire |
  | ------------------------ | --- | --------- |
  | jokers                   | yes | no        |
  | power-ups                | yes | no        |
  | coins (starting, awards) | yes | no        |
  | leagues                  | yes | no        |
  | quickfire question timer | no  | yes       |

  It derives from that table:
  - **the settings refusal**: given a mode, a settings patch and league ids, the first refusal message or none, checking only what the patch names. Its order and messages are the backend's current ones. It replaces the backend's settings refusal; the league and coin-award messages move here too.
  - **the settings to send**: the settings a client sends for a mode (a quickfire mode drops the coin settings). It replaces the frontend's "without coin settings" helper.
  - **the settings a mode plays with**: the session settings with everything the mode disallows switched off (jokers off, power-ups off, starting coins zero). Its fields stay present so the settings shape doesn't change.
  - a plain "is quickfire" question on a mode, for the few callers that only need that
- **The backend applies the mode when it loads a game.** The seed step that builds a session's settings from the stored row passes them through "the settings a mode plays with". Both new sessions and restored ones load through that step, so in memory a quickfire session's settings never have jokers, power-ups or coins on. Stored rows aren't rewritten; no migration.
- **Backend callers ask the module:** session creation and the lobby's settings/league save (settings refusal), league assignment (leagues allowed), coin awards (coins allowed), the running-sessions summary and the quickfire-quiz check (is quickfire). The backend's own quickfire session rules file goes away.
- **The snapshot carries the quiz mode.** The shared snapshot every room resyncs to gains the session's quiz mode. The `/control` lobby's settings panel reads it instead of the current round's quickfire flag. The snapshot's per-round quickfire field stays: `/play` and the big screen read it for the current round's engine behaviour, and the engine's per-round flag stays as ADR 0005 keeps it. This is an additive protocol change; reconnect is unaffected because the field arrives with every snapshot.
- **`/control` forms take the mode, not a boolean.** The start-session dialog, the lobby's settings panel and the settings form receive the quiz mode and ask the module what to show, which tabs to offer and what to send. The start dialog already has the quiz's mode from the quiz list.
- **Deleting the dead per-round gates**, now that a quickfire session's settings always have power-ups off:
  - the purchase path's "no question power-up in a quickfire round" check (by the time this step runs it lives in the Power-up offer module, per the `power-up-offer` spec, which leaves its removal to this spec)
  - the extra joker's next-round rule skipping a quickfire round
  - the live-edit rebuild refunding an extra joker whose round became a quickfire round (a live edit can't change the mode)
- **What stays where it is:** the quickfire allowed question types in the question type registry (ADR 0001); the engine's per-round flag and everything that reads it for block, reveal, timer and leaderboard behaviour; the mode on the quiz (ADR 0005).

## Testing Decisions

- **A good test asks the module what a mode allows, refuses or sends, and checks the answer.** It doesn't check how a form hides a field or which helper the controller calls.
- **The new seam is the Quiz mode module (shared types, Vitest):**
  - one table test per mode for what it allows
  - the settings refusal cases: each disallowed setting named in a patch, unrelated settings accepted, league ids, the existing refusal order, a pub mode refusing nothing
  - the settings to send for each mode
  - the settings a mode plays with: a quickfire mode turns on-flags off and leaves the other settings untouched; a pub mode returns the settings unchanged

  The backend's existing settings-refusal cases move here. Prior art: the quickfire visibility and session scales tests in the shared types tests folder.
- **Backend wiring stays covered by the existing DB-backed specs:** sessions controller (creation refused for a quickfire quiz with jokers), league service and league changes (league refusal), bonus awards (coin award refusal), seed service. Add one seed-service case: a stored session row for a quickfire quiz with jokers and power-ups on loads with both off.
- **Frontend:** the session settings form, the lobby's settings panel and the start-session dialog tests switch from passing a boolean to passing a mode. They keep one rendering check per mode (quickfire hides jokers, power-ups, coins and leagues and shows the timer; pub the reverse) and drop rule cases the module now covers.
- **Power-up code:** the specs that pin the deleted gates (a quickfire round refusing a question power-up, the extra joker skipping a quickfire round, the live-edit refund for a round turned quickfire) are deleted with them; the rest of the purchase and live-edit specs pass unchanged.
- Run `pnpm crap:changed` and `pnpm mutate:changed`; the module should leave no survivors.

## Out of Scope

- Moving the engine off its per-round quickfire flag, or removing the snapshot's per-round field.
- Changing which question types a quickfire quiz allows (ADR 0001, the question type registry).
- Rewriting stored session settings in the database: the mode is applied when a game loads.
- The Power-up offer module itself (`power-up-offer`) and the Coin ledger (candidate 2). This spec only deletes the quickfire gate the offer module inherits.
- The `/play` page's quickfire checks for power-ups, which `power-up-offer` already moves into the offer.
- Any change to what the moderator sees: the same fields show and hide, so no `/guide` update.

## Further Notes

- Glossary: **Quiz mode** already says what each mode is. Add one sentence that a quickfire quiz's sessions have no jokers, power-ups, coins or leagues, if it isn't there already. `DOCUMENTATION.md`'s settings section gains the snapshot's quiz mode field.
- Commit scopes: `shared-types` for the module and the snapshot field, `backend` for the callers and the seed step, `frontend` for the `/control` forms.
- Order: the module and the backend callers first, then the snapshot field and `/control`, then the seed step and the gate deletion. Only the gate deletion waits for `power-up-offer`.
- The review counted 31 `!isQuickfire &&` branches; after the quickfire-mode PR merged there are about a dozen across the start dialog, the lobby's panel and the settings form.
