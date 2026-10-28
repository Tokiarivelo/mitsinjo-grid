# Format rules (always on, every agent): one formatter, one style

- **Prettier is the only formatter.** Version pinned exactly in root `package.json`; config in `.prettierrc`,
  exclusions in `.prettierignore`. Never add another formatter (Biome, dprint, ESLint stylistic rules, editor defaults).
- Never hand-format or argue style in review: line breaks, quotes, commas and wrapping are whatever Prettier prints.
  A diff that only re-wraps code (e.g. one-line object → multi-line) is formatting, not a change.
- **Automatic, nothing to remember:**
  - Claude Code: `.claude/hooks/format.sh` formats each file after Edit/Write, once a human runs `make setup-claude`.
  - Every agent (Gemini, opencode, Codex, Cursor…) and human: git pre-commit hook (`simple-git-hooks` → `lint-staged`) formats staged files.
  - CI: `pnpm format:check` fails on unformatted files.
- Agents without hooks, or files changed by shell commands (`sed`, scripts, codegen): run `/format`
  (`make format-changed`) before committing.
- Format only what you touched: never mix a repo-wide reformat into a feature/fix commit; use a separate `style:` commit.
