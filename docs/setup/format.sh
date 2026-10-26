#!/usr/bin/env bash
# Claude Code PostToolUse hook: format the edited file with Prettier.
# Silent and non-blocking (no output, always exit 0) so it costs no context tokens.
# Skips when Prettier isn't installed yet. Needs jq.
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[[ -z "$f" || ! -f "$f" ]] && exit 0
case "$f" in *.ts|*.tsx|*.js|*.mjs|*.json|*.css|*.md) ;; *) exit 0 ;; esac
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
[[ -x node_modules/.bin/prettier ]] && node_modules/.bin/prettier --write --log-level silent "$f" >/dev/null 2>&1
exit 0
