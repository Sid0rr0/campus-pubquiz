# Spec: One Bonus award policy; the bonus service only stores

Status: ready-for-agent

Source: architecture review 2026-11-21, candidate 5 ("One Bonus award policy").

## Problem Statement

The rules for whether the quiz master may give a **Bonus award** (and a **Coin award** with it) are split across two modules with a seam between them:

- The **bonus awards change module** checks the coin rules: no coin award in a **Quickfire quiz**, no coins without power-ups, and no take larger than the team's balance. It then unpacks four session settings (enabled bonus categories, per-category cap, power-ups on, the block for a new award) into positional arguments.
- The **bonus service's award** takes nine positional parameters and checks the rest: non-zero points, coins need power-ups (**a second time**), the category is enabled, a custom award has a reason, the team is on the roster, and the per-category cap. It then stores the award and works out the shot/selfie coins it earns.

So a reader has to open both modules to learn what an award may do, and the coin check runs twice. Two other callers have to get past rules that were never meant for them:

- A **Showdown** win passes `['custom']` and `{}` as dummy arguments, so the session's enabled categories and caps can't block the winner's points.
- The **covering coin award** made when a deleted award's coins were already spent goes through the same nine-argument call as a zero-point custom award, with a made-up reason. The service treats it like an award the quiz master typed.

Editing an award has its own rules too (non-zero points, custom needs a reason, a shot or selfie award can't flip between bonus and penalty). They live in the service, mixed in with the storing.

Every rule test today needs a database, because the rules sit in the same methods as the database writes.

## Solution

One pure **Bonus award policy** decides whether a quiz master's award or edit is allowed. Given the session, the requested award, and the facts it needs that only the database knows (how many awards of that category the team already has), it returns a refusal message or the award to store. That includes the trimmed reason and the coins it earns. The bonus service becomes the bonus store: it stores what it's given and reads awards and coin totals. It no longer decides anything.

The showdown win and the covering coin award stop pretending to be quiz master awards. Each calls the store directly with what it means: "store a custom award of these points for the showdown winner" and "store a coin award covering these spent coins".

Quiz masters and teams see no difference. The same awards are allowed, the same refusals arrive with the same messages, and the same toasts reach the same phones.

## User Stories

1. As a quiz master, I want a shot, selfie or custom bonus award to be allowed or refused exactly as today, so that the refactor costs me nothing on a quiz night.
2. As a quiz master, I want a custom award without a reason refused with today's message, so that every custom award says what it was for.
3. As a quiz master, I want an award in a category this session has turned off refused with today's message, so that the session's settings hold.
4. As a quiz master, I want an award past the per-category cap refused with today's message, so that the cap holds.
5. As a quiz master, I want a coin award in a session without power-ups refused with today's message, so that coins only exist where they mean something.
6. As a quiz master, I want a coin award in a quickfire quiz refused with today's message, so that quickfire stays coin-free.
7. As a quiz master, I want a take larger than the team's balance refused with today's message, so that a balance never hides a debt.
8. As a quiz master, I want an award with zero points and no coins refused with today's message, so that an empty award isn't stored.
9. As a quiz master, I want a zero-point award with coins to give the coins alone, with no bonus award and no bonus toast, as today, so that I can hand out coins on their own.
10. As a quiz master, I want an award to a team that isn't on the roster refused with today's message, so that a stale control panel can't award a team that left.
11. As a quiz master, I want a refusal to show the same message as today when several rules fail together, so that what I see doesn't change.
12. As a quiz master, I want a positive shot or selfie award in a session with power-ups to still bring its two coins, so that the coin reward for shots and selfies holds.
13. As a quiz master, I want editing an award's points and reason to be allowed or refused as today (non-zero points, a custom reason, no sign flip on a shot or selfie award), so that edits behave the same.
14. As a quiz master, I want editing or deleting an award from another session refused as "not found", as today, so that the session stays the security boundary.
15. As a quiz master, I want deleting an award whose coins were already spent to still add a covering coin award with today's reason, so that the team's balance never shows a hidden debt.
16. As a quiz master, I want a showdown winner to still get the round's points as a custom award with today's "Showdown: …" reason, even when the session has custom awards off or capped, so that a showdown always pays out.
17. As a team, I want the bonus toast and the coin toast with my new balance to arrive as today, so that I see what I got.
18. As a team, I want a coin award's reason shown only when the quiz master typed coins, as today, so that a shot's automatic coins don't repeat the reason.
19. As a developer, I want every rule for a quiz master's award and edit in one pure module, so that I learn what an award may do by reading one place.
20. As a developer, I want the coin rules for an award checked once, so that two copies can't drift apart.
21. As a developer, I want the bonus store's award call to take one record of what to store instead of nine positional arguments, so that a call site reads as what it stores.
22. As a developer, I want the showdown win and the covering coin award to call the store for what they mean, so that neither passes dummy arguments to get past rules.
23. As a developer, I want the policy tested without a database, so that the rule table runs fast and each rule has its own case.
24. As a developer, I want the bonus store's tests to cover only storing and reading, so that the database tests stay small.

## Implementation Decisions

### The Bonus award policy

- A new **pure module in shared types**, next to the Coin ledger and the Power-up offer (same pattern: inputs in, refusal or result out, no I/O).
- **Award decision.** Inputs:
  - the session (its seeded game's quiz mode and settings: enabled bonus categories, per-category cap, power-ups on; its roster; its coin awards and Scoring records/purchases, for the balance);
  - the requested award (team id, category, points, reason, manual coins);
  - the team's existing award count in that category.

  It returns either a refusal message or the **award to store**:
  - the category and points, or no bonus award at all when the points are 0;
  - the reason: trimmed, kept only for custom;
  - the shot/selfie coins the award earns, from the existing coins-earned rule;
  - the manual coins, with the trimmed reason they carry;
  - the block for a new award.
- **Refusal order is today's order**, so the same message shows when several rules fail:
  1. the coin award refusal (quickfire, then power-ups off);
  2. the take refusal;
  3. zero or non-finite points with no coins;
  4. category not enabled (only when points are non-zero);
  5. custom without a reason (only when points are non-zero);
  6. team not on the roster;
  7. the cap (only when points are non-zero).

  The second "coins need power-ups" check in the service goes: step 1 already covers it.
- The roster check reads the session's roster (it's refreshed from the stored roster on every roster change), not a database lookup.
- **Edit decision.** Inputs: the stored award (category, points) and the requested points and reason. Returns a refusal or the points and reason to store (reason kept only for custom). Rules and messages as today: non-zero finite points, custom needs a reason, no sign flip on a shot or selfie award.
- Refusal messages are unchanged, word for word.

### The bonus store (today's bonus service)

- **Award call:** takes the session id, the team id and the award to store (the policy's output shape) as one record. It persists the bonus award (if any), the linked shot/selfie coin award, and the manual coin award in one flush, as today, and returns the coins given and the team's coin total.
- **Count call:** a read of a team's award count in one category, for the policy's input.
- **Update call:** takes the decided points and reason. It keeps its own "not found in this session" check, which stays a store concern because it's a lookup scoped to the session id.
- **Covering coin award:** a store call that stores a coin award of given coins with a given reason and no bonus award.
- **Remove**, the reads and the admin views are unchanged.
- The store keeps the not-found error type. The invalid-award error type is no longer thrown by the store. The change module turns a policy refusal straight into the existing invalid-award refusal, so the client sees the same refusal type and message.

### Callers

- **Bonus awards change module, award:** reads the team's category count, asks the policy, throws the refusal or passes the award to the store, then builds the same notices and change as today.
- **Bonus awards change module, edit:** reads the stored award through the store (not found as today), asks the policy's edit decision, and stores the result.
- **Bonus awards change module, remove:** the covering coin award calls the store's covering call with today's reason. It goes through no policy, because it isn't a quiz master award (today it only met the power-ups check, which can't fail when coins were spent, since spending needs power-ups).
- **Showdown resolve:** stores the winner's custom award through the store's award call with an award record it builds itself (custom, the round's points, today's reason, no coins). No policy and no dummy arguments, because a showdown win isn't a quiz master award and the session's categories and caps don't apply to it.

### Docs

- `GLOSSARY.md`: add **Bonus award policy**: the rules for whether the quiz master may give or edit a bonus award, and what is stored. Add to **Showdown** that the win's custom award ignores the session's bonus categories and caps, if it doesn't already say so.
- `DOCUMENTATION.md`: no behaviour change. Update any passage that says the bonus service checks the rules.
- Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

- Good tests give inputs a client or caller would give and assert the refusal message or what was stored and sent. They never assert which module made a decision or what arguments were passed.
- **Behaviour seam (existing): the game test suite's gateway handlers with the real Postgres store.** The award-bonus, bonus-changed, coin-awards, team-coins, carried-coin, grade-and-bonus-write and showdown specs must pass unchanged. They pin that awards, edits, deletes with covers, toasts and showdown payouts behave as today. Add one case if none exists: a showdown win pays out in a session with custom awards turned off.
- **Rule seam (new, pure): the Bonus award policy in shared types.** It moves the rule cases down from the bonus service's database spec: every refusal, the refusal order when several rules fail, coins-only awards, the trimmed reason, the shot/selfie coins earned, and the edit rules. Prior art: the Power-up offer and Coin ledger specs in shared types.
- **Bonus store spec (existing, narrowed):** keeps storing (bonus award plus linked coins in one flush, coins only, covering coin award), the category count, not-found on update and remove scoped by session, and the admin and team views. Its rule cases move to the policy spec.
- Run `pnpm crap:changed` and fix what it flags. The change module, the service and the showdown service are touched.

## Out of Scope

- Using the policy on `/control` to grey out a refused award before it's sent.
- Changing any rule, cap, message or coin amount.
- Attributing awards to the user who gave them (an accepted tradeoff in CLAUDE.md).
- Changing the bonus award REST edit/delete endpoints' contracts.
- Candidates 1–4 and 6 of the same architecture review.

## Further Notes

- The policy's balance input comes from the Coin ledger. If the scoring-records spec lands first, the ledger reads purchases only from the session's Scoring records. Either order works, because the policy only calls `coinBalance` on the session.
- The covering coin award can skip the power-ups check safely. A shortfall exists only when a deleted award's linked coins were spent, and an award brings coins only with power-ups on. Session settings, power-ups included, are lobby-only, so they can't be switched off afterwards.
