# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-26 · **By:** Gemini (P2 UI Kit + i18n next-intl + rules) · **Day:** 2 / 10

## State

- Phase: **P1 — Repo** completed (P1-T0..T7, T9 done; CI, Turbo, engine + web apps).
- Phase: **P2 — Design system** completed (UI kit, AppShell, `/design` catalog, vitest tests).
- Phase: **P0 — Framing** (P0-T1 fallback to `mock`, P0-T3 parameters, P0-T4 i18n EN/FR/MG).
- **Multi-language (i18n):** official `next-intl` integrated with EN, FR, MG dictionaries and LanguageSwitcher in Header & Sidebar.
- Monorepo healthy: `make check` (18 tests) and `pnpm build` pass with 0 errors.

## Next task

- `docs/tasks/P3-engine.md` → P3-T1 (Zod schemas in `packages/engine/src/schemas/` + inferred types).

## Decisions taken

- Multi-language official package: `next-intl` with client provider and zero-exception SSR fallback.
- Added i18n rule to `.claude/rules/web-ui.md`, `CLAUDE.md`, and `docs/conventions.md`.
- LanguageSwitcher tabs in Sidebar footer and compact picker in Header.
- Resolved `P0-T4` with EN (default for judges) + FR & MG toggles.

## Open questions / blockers

- Meta API key / endpoint credentials for live Llama inference (offline mock ready as fallback).

## Files touched this session

- `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/messages/{en,fr,mg}.json`
- `apps/web/src/lib/i18n.tsx`, `apps/web/src/components/ui/language-switcher.tsx`
- `apps/web/src/components/layout/{sidebar,header,copilot-panel,app-shell}.tsx`
- `.claude/rules/web-ui.md`, `CLAUDE.md`, `docs/conventions.md`, `docs/tasks/P0-framing.md`, `HANDOFF.md`
