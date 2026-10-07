#!/usr/bin/env bash
# Claude Code WorktreeRemove hook: removes the worktree and its worktree-<name>
# branch. Both steps refuse to destroy work: `worktree remove` fails on
# uncommitted changes, and `branch -d` keeps a branch with unmerged commits.
set -uo pipefail

input=$(cat)
worktree_path=$(jq -r '.worktree_path' <<<"$input")
repo="${CLAUDE_PROJECT_DIR:-$(jq -r '.cwd' <<<"$input")}"

[ -d "$worktree_path" ] || exit 0

branch=$(git -C "$worktree_path" branch --show-current)
git -C "$repo" worktree remove "$worktree_path" >&2 || exit 1

case "$branch" in
  worktree-*) git -C "$repo" branch -d "$branch" >&2 || echo "kept $branch: it has unmerged commits" >&2 ;;
esac
exit 0
