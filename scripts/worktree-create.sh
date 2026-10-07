#!/usr/bin/env bash
# Claude Code WorktreeCreate hook: creates the worktree the way Claude Code
# would (.claude/worktrees/<name> on branch worktree-<name> at HEAD), then
# installs dependencies and builds @campus-pubquiz/types so the worktree can
# typecheck and commit straight away.
# Stdout must carry only the worktree path; everything else goes to stderr.
set -euo pipefail

input=$(cat)
name=$(jq -er '.name' <<<"$input")
repo="${CLAUDE_PROJECT_DIR:-$(jq -er '.cwd' <<<"$input")}"
worktree_path="$repo/.claude/worktrees/$name"

git -C "$repo" worktree add -b "worktree-$name" "$worktree_path" HEAD >&2
(
  cd "$worktree_path"
  pnpm install --frozen-lockfile >&2
  pnpm --filter @campus-pubquiz/types build >&2
)

echo "$worktree_path"
