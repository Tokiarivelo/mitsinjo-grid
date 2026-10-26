---
name: design-dispatch
description: Dispatch design-system implementation (tokens, UI kit, shell, one screen) to a subagent with minimal context. Use when asked to generate or implement the design system or a screen in parallel.
---

Spawn one subagent per independent unit; give it ONLY these paths, not this conversation:

- Tokens + fonts → `docs/design/tokens.md` → `apps/web/src/app/globals.css`, `src/lib/fonts.ts`.
- UI kit → `docs/design/components.md` + `.claude/rules/web-ui.md` → `src/components/ui/*`.
- Shell → `docs/design/shell.md` → `src/components/layout/*`.
- Screen X → `docs/design/screens/X.md` + `docs/design/components.md` → `src/features/<feature>/ui/*`.
- Stitch generation → `docs/design/stitch-prompts.md`; with Stitch MCP connected an agent can generate + export to `design/stitch/` and fill `stitch-map.md`.

Prompt template for the subagent:
"Implement <unit> for Mitsinjo Grid. Read only: <paths> + `docs/design/stitch-map.md` and the mockup PNG it lists for <unit> (if any); follow `.claude/skills/design-check/SKILL.md` before and after. Write only under <target>. Use Tailwind tokens, no raw hex.
Add tests in **tests**/. Run `pnpm --filter web typecheck && pnpm --filter web test`. Reply with files changed + check results, ≤ 10 lines."

Run tokens first (others depend on it); kit and shell can run in parallel afterwards; screens after kit.
