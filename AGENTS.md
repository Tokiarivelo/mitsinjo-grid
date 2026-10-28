# AGENTS.md

All agents (Claude, Codex, Cursor, Gemini…) follow `CLAUDE.md`. Same rules, same doc map.
Session protocol: read `HANDOFF.md` → do one task from `docs/tasks/` → overwrite `HANDOFF.md`.

**Formatting (every agent):** Prettier only, pinned in `package.json`, config `.prettierrc`. The git pre-commit hook
formats staged files and CI runs `pnpm format:check`. If your tool has no edit hook, run `make format-changed` before
committing. Rules: `.claude/rules/format.md`.
