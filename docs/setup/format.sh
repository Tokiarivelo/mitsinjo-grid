#!/usr/bin/env bash
# Claude Code PostToolUse hook: format the edited file with the repo's pinned Prettier.
# Silent and non-blocking (no output, always exit 0) so it costs no context tokens.
# Rule: .claude/rules/format.md. Skips when dependencies aren't installed yet.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[[ -x node_modules/.bin/prettier ]] || exit 0
f=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})' 2>/dev/null)
[[ -z "$f" || ! -f "$f" ]] && exit 0
node_modules/.bin/prettier --write --ignore-unknown --log-level silent "$f" >/dev/null 2>&1
exit 0
