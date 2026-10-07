# Local skill changes

Skills under `.claude/skills/` are symlinks into `.agents/skills/`, which is gitignored and overwritten when the skills are reinstalled or updated upstream. This log is the record of every local edit, so it can be re-applied after an update. Add an entry whenever a skill is changed in this repo.

One section per skill, headed with the skill name and the file that was edited. Each entry: date, what changed, and why (the session or incident that prompted it).

## implement-spec (`.claude/skills/implement-spec/SKILL.md`)

### 2026-10-08: git and worktree mechanics (from the live-edit-save retro)

- **Step 3**: create the integration branch from `main`. If a branch by that name already exists, show `git log main..<branch>` and ask before moving it.
  _Why:_ a stale integration branch made the agent try `git branch -f` / `fetch . main:…`. The safety gate and the auto-mode classifier blocked both, and the run stalled until the user moved the branch by hand.
- **Step 4, implementer bullets**:
  - start the ticket branch with `git checkout -b ticket/<slug> <integration-tip-sha>`. This replaced "resets onto it if not".
    _Why:_ "resets" sent implementers to `git reset --hard`, which the gate blocks.
  - run `pnpm install` then `pnpm --filter @campus-pubquiz/types build` before anything else.
    _Why:_ `@campus-pubquiz/types` resolves through `dist`, so a fresh worktree fails typecheck and the pre-commit hook until the package is built. Every merger rediscovered this. A root `postinstall` would also fix it, but it breaks `apps/backend/Dockerfile`, which installs before copying `shared/types`.
  - write files with Write/Edit and run commands from the worktree root.
    _Why:_ the worktree sandbox refused 16 of about 290 subagent commands (heredoc writes, python edit scripts, `cd` chains).
- **Step 5**: the merger runs the same setup and names any temporary branch it creates.
- **Step 8**: move the spec to done in `.scratch/overview.md` / `done.md` on `main` after the integration branch lands.
  _Why:_ marking it done on the integration branch conflicted with `main`'s edits to the same table.
- **Step 9**: remove worktrees, then hand the user one `git branch -D` command listing every branch the run created, with shas.
  _Why:_ the gate blocks agent-run `branch -D`, and about 18 `ticket/*`, `tmp-merge-*` and `worktree-agent-*` branches were left behind.

### 2026-10-08: open a PR at the end

- **Step 10 (new)**: push the integration branch, generate the PR body with the `pr` skill into a scratchpad file, then open the PR on GitHub with `gh pr create --body-file` (or `gh pr edit --body-file` on an existing draft PR) and report the URL.
  _Why:_ the run ended with a bare integration branch; the user wanted the PR, with its `/pr`-generated text, opened on GitHub as part of the skill.

### 2026-10-08: branch cleanup with the safe delete

- **Step 9**: once the integration branch has merged into `main`, delete `ticket/*` and the mergers' temporary branches with `git branch -d`. Before then, list them in the report, and hand any branch `-d` refuses to the user with its sha. This replaces handing the user a force-delete command.
  _Why:_ every branch the run creates is fully merged once the PR lands (merge commits), so the safe `-d` works and the gate never fires.

### 2026-10-08: worktree setup moves into a `WorktreeCreate` hook

- **Step 4 / 5**: dropped the "run `pnpm install` + types build" setup bullet and the merger's "same setup".
  _Why:_ `.claude/settings.json` now has a `WorktreeCreate` hook (`scripts/worktree-create.sh`) that creates `.claude/worktrees/<name>` on `worktree-<name>`, installs dependencies, and builds `@campus-pubquiz/types` before the subagent starts (about 7s). The hook's input is `{name, cwd, …}`; there is no `base_path` field, despite the docs example.
- **Step 9**: remove each worktree with `git worktree remove <path>` and delete its `worktree-<name>` branch with `git branch -d`; a worktree `remove` refuses is listed for the user.
  _Why:_ worktrees created by the hook are not cleaned up when the subagent finishes, even when unchanged, and the `WorktreeRemove` hook did not fire (tested 2026-10-08). The hook is still wired in case Claude Code removes a worktree itself.
