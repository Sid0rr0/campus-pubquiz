# Power-ups follow-ups

- Joker fun facts (`best_joker`, `joker_backfired`, favourite/snubbed round) ignore the extra-joker round: the session snapshot caches no extra-joker purchases (only `funFactData.powerUps` costs by team), so counting them needs the purchase rows in `funFactData`.
- Ask the room's greyed-out "Waiting for more answers" button: the flag would change as other teams answer, but the phone only hears purchases on its own purchase, so an `enoughAnswers` boolean on `TEAM_PURCHASES_SYNCED` would go stale. It needs its own sync (or a flag on the question's players view) pushed when another team's answer lands.
- A live edit that moves or deletes a round does not re-point stored extra-joker purchases (`purchases.round_id`); only the quiz master's joker follows the rounds.
