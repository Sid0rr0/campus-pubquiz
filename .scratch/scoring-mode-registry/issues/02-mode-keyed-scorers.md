# 02: Sort and match score through a scorer for each mode

**What to build:** Sort and match questions score exactly as today, but each scoring mode's rule is its own named function, as the [spec](../spec.md) describes. Today sort's `exact` and match's `per_item` are just the branch that runs when nothing else matches; with this ticket, a mode added to a type's list without a scorer fails to compile instead of silently scoring as `exact` on stage.

- **The sort and match answer formats** each hold a record from mode to scoring function, typed so its keys must be exactly that type's modes from the table in ticket 01. `score` keeps its shared "fully right is full points" check, then looks up the mode's function on the resolved Answer key, which always carries a mode.
- **Results are preserved exactly:** sort `exact` returns incorrect for anything not fully right, sort `per_item` and match `per_item` return the rounded share, and `one_off` gives half points for one swap (sort) or one wrong pair (match).
- Key-fix regrading needs no change: it goes through the same `scoreSubmission`.
- **Docs:** update the "Question types are defined once" bullet in `CODING_STANDARDS.md` so it names the per-type scoring-mode table and the mode-keyed scorer as the two places a new mode goes.
- The guide text for this spec goes in ticket 03, not here.

**Blocked by:** 01 (Each type's scoring modes come from one table)

**Status:** done

- [ ] The existing scoring and answer-kind tests for every sort and match mode pass unchanged
- [ ] One case each: a sort question with the mode unset scores as `one_off`, and a match question with the mode unset scores as `per_item`
- [ ] Removing a mode's scorer from either record is a `pnpm typecheck` error
- [ ] `CODING_STANDARDS.md` names the table and the scorer record as where a new mode goes
