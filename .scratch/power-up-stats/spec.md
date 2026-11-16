# Power-up session stats

Status: done

Agreed in a grilling session on 2026-11-16.

## Stats page (`/stats/:id`): a Power-ups section

- Shown when the session had power-ups on **or** has any purchase (carried coins can be spent with power-ups off). Power-ups on but nothing bought: "No power-ups used". Quickfire sessions never show it.
- Tiles: total uses, total coins spent, **most used** (a tie names every tied power-up), **most effective** (the highest **Power-up hit rate** among question power-ups, a tie names every tied one, "—" when none hit).
- Table: one row per power-up offered or used, with uses, teams that used it, coins spent and hit rate with its count ("80% · 4 of 5"). No minimum number of uses. The extra joker's row shows **points gained** (its round's raw points for the buying team) instead of a hit rate, and it never competes for most effective.
- Counts every team that took part, departed teams included.
- Hit rate: credited like the correct rate (partial by its points' share). A blank or missing answer is a miss; each power-up on a question is its own use.

## Break fun facts

- **Power-ups so far** (`power_ups_so_far`): uses per question power-up.
- **Power-up paid off** (`power_up_paid_off`): the best hit rate so far, at least 2 uses and at least one hit; a tie goes to more uses, then power-up order.
- Both read only purchases on questions of revealed blocks by teams on the roster (like the fun facts' answers), name no team, and leave out the extra joker (the joker facts already count it).

## Out of scope

Night brief, team page, a per-team column or "big spender", trends across sessions.
