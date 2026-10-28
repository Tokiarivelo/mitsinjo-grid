# AGENTS.md

All agents (Claude, Codex, opencode, Gemini CLI, Antigravity, Cursor…) follow `CLAUDE.md`. Same rules, same doc map.
Session protocol: read `HANDOFF.md` → do one task from `docs/tasks/` → overwrite `HANDOFF.md`.

Entry files: Codex / opencode / Cursor read this file; Gemini CLI / Antigravity read `GEMINI.md` (points here);
Claude Code reads `CLAUDE.md`. Rules live in `.claude/rules/*.md` and skills in `.claude/skills/<name>/SKILL.md`:
plain Markdown, so any agent can follow them (e.g. "run `/format`" = follow `.claude/skills/format/SKILL.md`).

## Formatting (every agent, mandatory)

Rule: `.claude/rules/format.md`. Prettier is the only formatter, pinned in root `package.json`, config `.prettierrc`.

- After editing files, before committing: `make format-changed` (formats changed + untracked files).
- Automatic for everyone: the git pre-commit hook (installed by `pnpm install` / `make git-hooks`) formats staged files,
  and CI fails on unformatted files (`make format-check`).
- opencode formats with the project's Prettier on its own; Claude Code uses its edit hook (`make setup-claude`).
- Re-wrapping by Prettier (one-line object → multi-line) is formatting, not a change: don't undo it.
