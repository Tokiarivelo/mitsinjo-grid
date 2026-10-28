---
name: format
description: Format changed files with the repo's pinned Prettier and check the result. Use automatically after editing files with shell commands or scripts, before every commit, and whenever a diff shows style-only noise or `format:check` fails.
---

Follow `.claude/rules/format.md`.

1. `make format-changed` — Prettier on files changed vs `HEAD` plus untracked files (silent on success).
2. `make format-check` — whole repo; report only the files still listed.
3. Files still listed that you didn't touch: leave them for a separate `style: format with prettier` commit, never
   inside a feature/fix commit.
4. Report in one line: `✅ formatted <n> files` or the remaining paths.
