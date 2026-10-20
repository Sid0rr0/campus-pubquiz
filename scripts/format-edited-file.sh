#!/usr/bin/env bash
# Claude Code PostToolUse hook (Edit|Write): runs Prettier on the file just
# edited, the same files lint-staged formats at commit. Without it `pnpm lint`
# fails on prettier/prettier errors before the commit ever formats them.
# Never blocks the edit: a Prettier failure is left for lint to report.
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
case "$file" in
  *.ts | *.tsx | *.js | *.jsx | *.mjs) ;;
  *) exit 0 ;;
esac
[ -f "$file" ] || exit 0

prettier="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0
# Prettier finds the config and .prettierignore from the file's own checkout.
"$prettier" --write --log-level=warn "$file" >&2 || true
