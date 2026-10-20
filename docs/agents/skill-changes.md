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
- **Step 7 (2026-10-13 retro)**: the review-fix implementer reports like the implementers in step 4.
  _Why:_ live-edit's fixer report didn't say whether the frontend tests ran.
- **Step 11 (2026-10-13 retro)**: run `pnpm typecheck`, `pnpm lint` and `pnpm test` on the integration tip before pushing, and quote the results and sha.
  _Why:_ two runs shipped a PR without checks on the final tip.

Worktree setup is `pnpm bootstrap` (root `package.json`): `pnpm install` plus the `@campus-pubquiz/types` build. The `WorktreeCreate` hook in `.claude/settings.json` (`scripts/worktree-create.sh`) runs it for every subagent worktree; its input is `{name, cwd, …}`, not the `worktree_name`/`base_path` in the docs example. Root `pnpm typecheck` rebuilds the shared types first, so a merge that changes them never typechecks against a stale `dist/`.

- **implement-spec step 4, implementer bullets (2026-10-14 retro)**: edit every file with Edit/Write (a rename is one `Edit` with `replace_all: true` per file); Bash only for `git`, `pnpm` and read-only `grep`/`ls`, one command per call from the worktree root, globs quoted.
  _Why:_ across the last seven runs, the worktree sandbox refused ~22 `sed`/`xargs`/heredoc/`cd`-chain edits and ~5 more failed on BSD `sed -i` or zsh globs, although every brief carried the old "sandbox refuses heredoc writes" parenthetical.
- **implement-spec step 5 (2026-10-14 retro)**: the merger runs `git commit` in the foreground with a long timeout, since the pre-commit hook runs `pnpm typecheck`.
  _Why:_ mergers polled for the commit with `sleep` and `until git …` loops, which the harness and sandbox block.
- **code-review step 3 (2026-10-14 retro)**: names `CODING_STANDARDS.md` as this repo's standards source instead of the generic `CODING_STANDARDS.md` or `CONTRIBUTING.md` example.
  _Why:_ the orchestrator ran `ls CONTRIBUTING.md` on every review and got exit 1.
- **Concurrency cap (2026-10-20 retro)**: at most 4 implementers run at once (intro paragraph and step 6), replacing "maximum concurrency".
  _Why:_ e2e-journeys-2 started ~10 implementers together; all ten died in the same minute on the account's session rate limit (HTTP 429), and the user had to resume the run by hand.
- **Step 4, e2e bullet (2026-10-20 retro)**: run `pnpm e2e` in the foreground with a 600000 ms timeout; `pnpm e2e` itself takes a run lock shared by every worktree (`e2e/support/run-lock.ts`).
  _Why:_ the orchestrator pasted a hand-rolled `mkdir` lock into every brief, and while waiting, six implementers called `Monitor` with ToolSearch's arguments or tried a blocked `sleep`.
- **Step 10 (2026-10-20 retro)**: remove every worktree holding the integration branch or a `ticket/*` branch, done when `git worktree list` shows none, and repeat after later conflict/review fixes; delete branches only after `git checkout main && git pull --ff-only`.
  _Why:_ twice the user's `git checkout integration/…` failed with "already used by worktree" (a merger's and a conflict-fixer's worktree), and `git branch -d` refused merged ticket branches because local `main` hadn't caught up.
- **implement-spec steps 4 and 11 (2026-10-20)**: implementers no longer run `pnpm e2e`; the orchestrator runs it once on the integration tip in step 11, before pushing and opening the PR.
  _Why:_ every implementer queued on the shared e2e run lock, serialising the run; the journeys only need to pass on the final tip.
- **implement-spec steps 4, 7 and 10 (2026-10-20 retro)**: ticket branches are `ticket/<spec>/<slug>` and the review fixes go on `ticket/<spec>/review-fixes`; once the user says the PR merged, step 10 checks `gh pr view … --json state` and deletes the run's branches with `git branch -D`, since PRs are squash-merged.
  _Why:_ a second spec's `git worktree add -b ticket/review-fixes` failed because the first spec's branch was waiting on its unmerged PR; and five merged integration branches were still local, with the user asking "delete the old branches".
- **implement-spec step 5 (2026-10-20 retro)**: mergers are spawned with `model: "haiku"`.
  _Why:_ a day of nine runs (~100 subagents) hit the account's weekly limit mid-run; a merger only runs `git merge` and `git commit`.
- **to-tickets step 3 and new step 6 (2026-10-20 retro)**: check ticket pairs for overlap; add the spec's row to `.scratch/overview.md`, checked by `scripts/check-scratch-index.mjs` (pre-commit and CI).
  _Why:_ after the architecture review the user had to ask twice for specs to be added to the overview; display-screen-content's ticket 05 implementer found ticket 04 had already built its code.
