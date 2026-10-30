# Power-ups follow-ups

- Ask the room's greyed-out "Waiting for more answers" button: the flag would change as other teams answer, but the phone only hears purchases on its own purchase, so an `enoughAnswers` boolean on `TEAM_PURCHASES_SYNCED` would go stale. It needs its own sync (or a flag on the question's players view) pushed when another team's answer lands.
- A live edit that moves or deletes a round does not re-point stored extra-joker purchases (`purchases.round_id`); only the quiz master's joker follows the rounds.
- Mutation survivors: `apps/backend/src/game/state/purchase-changes.ts` (14 survived, 73% score) and `shared/types/src/power-ups.ts` (21 survived across the changed files, mostly label strings, plus arithmetic at line 106 and conditionals at lines 180 and 200). Add assertions that kill them.
