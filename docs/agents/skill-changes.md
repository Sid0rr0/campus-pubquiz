# Local skill changes

Skills under `.claude/skills/` are symlinks into `.agents/skills/`, which is gitignored and overwritten when the skills are reinstalled or updated upstream. This file lists how each skill differs from upstream, so the changes can be re-applied after an update. Keep it current whenever a skill is edited in this repo.

## implement-spec (`.claude/skills/implement-spec/SKILL.md`)

- **Step 3**: create the integration branch from `main`. If a branch by that name already exists, show `git log main..<branch>` and ask before moving it.
  _Why:_ moving an existing branch (`branch -f`, `fetch . main:…`) is blocked by the safety gate and the auto-mode classifier.
- **Step 4, implementer bullets**:
  - start the ticket branch with `git checkout -b ticket/<slug> <integration-tip-sha>` (upstream: "resets onto it if not").
    _Why:_ "resets" leads to `git reset --hard`, which the gate blocks.
  - write files with Write/Edit and run commands from the worktree root.
    _Why:_ the worktree sandbox refuses heredoc writes, python edit scripts and `cd` chains.
- **Step 5**: the merger names any temporary branch it creates in its report.
- **Step 10** (was 9): remove each worktree under `.claude/worktrees/` with `git worktree remove <path>` and delete its `worktree-<name>` branch with `git branch -d`; list any worktree `remove` refuses. Once the integration branch has merged into `main`, delete `ticket/*` and the mergers' temporary branches with `git branch -d`; before then, list them; hand any branch `-d` refuses to the user with its sha.
  _Why:_ the gate blocks force-deletes, while every branch the run creates is fully merged after the PR lands. Subagent worktrees are not cleaned up automatically.
- **Step 11 (new)**: push the integration branch, generate the PR body with the `pr` skill into a scratchpad file, open the PR with `gh pr create --body-file` (or `gh pr edit --body-file` on an existing draft PR), and report the URL.
- **Step 8 (new)**: on the integration branch, add the spec's row to the top of `.scratch/done.md`, remove it from `.scratch/overview.md`, and commit both as `docs(repo): move <spec> to done`, so the move ships in the PR. Later steps are renumbered 9–11.

Worktree setup (`pnpm install`, building `@campus-pubquiz/types`) is not in the skill: the `WorktreeCreate` hook in `.claude/settings.json` (`scripts/worktree-create.sh`) does it for every worktree. Its input is `{name, cwd, …}`, not the `worktree_name`/`base_path` in the docs example.
