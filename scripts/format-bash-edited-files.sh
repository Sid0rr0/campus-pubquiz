#!/usr/bin/env bash
# Claude Code Bash hook, the companion of format-edited-file.sh for files
# written from Bash (sed -i, python heredocs), which the Edit|Write hook never
# sees. `mark` (PreToolUse) stamps a marker; `format` (PostToolUse) runs
# Prettier on the checkout's changed TS/JS files that are newer than it, so
# only files this command wrote get formatted, not the user's open work.
# Never blocks the command: a Prettier failure is left for lint to report.
set -uo pipefail

input=$(cat)
session=$(jq -r '.session_id // "default"' <<<"$input")
cwd=$(jq -r '.cwd // empty' <<<"$input")
marker="${TMPDIR:-/tmp}/claude-bash-format-$session"

if [ "${1:-}" = mark ]; then
  touch "$marker"
  exit 0
fi

[ -f "$marker" ] || exit 0
root=$(git -C "${cwd:-.}" rev-parse --show-toplevel 2>/dev/null) || exit 0
prettier="$root/node_modules/.bin/prettier"
[ -x "$prettier" ] || prettier="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0

files=()
while IFS= read -r f; do
  case "$f" in
    *.ts | *.tsx | *.js | *.jsx | *.mjs) ;;
    *) continue ;;
  esac
  [ -f "$root/$f" ] && [ "$root/$f" -nt "$marker" ] && files+=("$root/$f")
done < <(git -C "$root" diff --name-only HEAD 2>/dev/null; git -C "$root" ls-files --others --exclude-standard 2>/dev/null)

[ ${#files[@]} -eq 0 ] && exit 0
# Prettier skips anything .prettierignore lists (applied migrations) even when named.
"$prettier" --write --log-level=warn "${files[@]}" >&2 || true
