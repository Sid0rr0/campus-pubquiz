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

- **Step 4, implementer bullets (2026-10-13 retro)**:
  - run only the specs it touches while iterating; run the full backend suite as `pnpm --filter backend test --maxWorkers=2`, in the foreground with a long timeout.
    _Why:_ in live-session-changes, five parallel implementers each started a Postgres container and an unbounded Jest run: 45 suites failed on resource starvation, and one agent spent ~20 minutes in `sleep` waiting on a background run.
  - write a shell variable before a colon as `${B}:path`.
    _Why:_ zsh read `git show $B:apps/…` as the `:a` modifier in two runs.
  - report `pnpm typecheck`, `pnpm lint` and test results with the sha they ran on.
- **Step 5 (2026-10-13 retro)**: a merger's own `git worktree add` worktree runs `pnpm bootstrap` first; the merger reports checks on the merged sha.
  _Why:_ every `TS2307 Cannot find module '@campus-pubquiz/types'` in the last five runs came from merger worktrees, which the `WorktreeCreate` hook never sees.
- **Step 11 (2026-10-13 retro)**: run `pnpm typecheck`, `pnpm lint` and `pnpm test` on the integration tip before pushing, and quote the results and sha.
  _Why:_ two runs shipped a PR without checks on the final tip.

Worktree setup is `pnpm bootstrap` (root `package.json`): `pnpm install` plus the `@campus-pubquiz/types` build. The `WorktreeCreate` hook in `.claude/settings.json` (`scripts/worktree-create.sh`) runs it for every subagent worktree; its input is `{name, cwd, …}`, not the `worktree_name`/`base_path` in the docs example. Root `pnpm typecheck` rebuilds the shared types first, so a merge that changes them never typechecks against a stale `dist/`.
