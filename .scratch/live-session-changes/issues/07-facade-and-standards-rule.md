# 07: The game state façade and the standards rule

**What to build:** With every domain's events built by change modules, the game state class reads as a façade. Each event is one write call, followed by the press, session lifecycle, the quiz-edit step and the getters. `CODING_STANDARDS.md` describes that structure, so reviewers check where the code lives instead of trusting a comment.

Tidy whatever the domain tickets left behind:

- helpers or imports in the game state class that nothing uses any more,
- a constant duplicated across change modules,
- any event method that is more than its write call plus the join's reply and wrapping.

Reword the Live session rule in `CODING_STANDARDS.md`: a shared step lives in its domain's change module, and a change module never holds the Session write module or the game state class. Keep the rest of the rule as it is: checks before database writes, and a refused event stores nothing.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 02, 03, 04, 05, 06

**Status:** done

- [ ] The game state class is under ~400 lines, and each change module is under ~250.
- [ ] No change module imports the Session write module or the game state class. A grep shows this.
- [ ] No unused helper, import or constant is left in the game state class.
- [ ] `CODING_STANDARDS.md`'s Live session rule is reworded as above. `GLOSSARY.md`, `DOCUMENTATION.md` and the `/guide` page are unchanged.
- [ ] If `docs/architecture.md` diagrams the game state internals, it shows the façade, the change modules and the Session write module.
- [ ] Every existing backend spec passes without edits.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
