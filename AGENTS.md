# AGENTS.md

**Stop. Read `CLAUDE.md` first and follow it exactly**, whatever your tool (Codex, opencode, Cursor, Gemini, Antigravity…).
It is the single source of rules, workflow and doc map.

## Non-negotiable task start rule

**Always branch from latest `main`:** Before beginning any task, fetch and branch from `origin/main` (`git fetch origin main && git checkout -b feat/<task-id>-<slug> origin/main`). Never commit directly on `main` or a stale branch.
