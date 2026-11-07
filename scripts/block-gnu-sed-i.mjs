#!/usr/bin/env node
// PreToolUse Bash hook: macOS (BSD) sed reads the word after `-i` as the backup suffix, so the
// GNU form `sed -i 's/a/b/' file` fails with "invalid command code" or "command a expects \".
let input = '';
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  const command = JSON.parse(input).tool_input?.command ?? '';
  // Only where sed is the command, not where a message or a quoted string mentions it.
  if (/(^|[;&|(`]|\n)\s*sed(\s[^|;&\n'"]*?)?\s-i\s+(?!''|"")/.test(command)) {
    console.error(
      "[Hook] BLOCKED: this is macOS sed: write `sed -i '' 's/a/b/' file` (an empty backup suffix after -i).",
    );
    process.exit(2);
  }
});
