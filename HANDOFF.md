# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-26 · **By:** Antigravity (P2 UI Kit + Zero-Static i18n + CI parity) · **Day:** 2 / 10

## State

- Phase: **P1 — Repo** completed (P1-T0..T7, T9 done; CI, Turbo, engine + web apps).
- Phase: **P2 — Design system & UI Kit** completed (`/design` catalog, components, vitest tests).
- Phase: **P0 — Framing** (P0-T1 mock fallback, P0-T3 parameters, P0-T4 i18n EN/FR/MG done).
- **Strict Multi-language (i18n):** official `next-intl`, zero hardcoded static text in JSX/TSX.
- Locales: `en` (default for judges), `fr`, `mg` with 100% key parity enforced via `make check-i18n` and CI.
- PR: `#1` on branch `feat/multilingual-ui-kit`.
- Monorepo healthy: `make check` (19 web + 5 engine tests) and `pnpm build` pass with 0 errors.

## Next task

- `docs/tasks/P3-engine.md` → P3-T1 (Zod schemas in `packages/engine/src/schemas/` + inferred types).

## Decisions taken

- Official `next-intl` package with dot-notated dictionary fallback for SSR/SSG.
- Zero static user-facing text rule added to `.claude/rules/web-ui.md`, `CLAUDE.md`, and `docs/conventions.md`.
- Automated key-parity & non-empty test added in `apps/web/src/test/i18n-parity.test.ts`.
- CI (`.github/workflows/ci.yml`) and `Makefile` updated with `check-i18n` target.
- Locale is client state in localStorage via `useSyncExternalStore`: SSR/hydration always render EN, then switch (no mismatch).
- Copilot panel shows the "AI unavailable" copy until the LLM is wired; no canned answers or invented numbers.
- `/design` logic lives in `features/design-system`; `app/design/page.tsx` only renders it.
- Known gap: feature pages are `'use client'` because i18n is client-only; move to cookie locale + server `getTranslations` if SSR text matters.

## Open questions / blockers

- Meta API key / endpoint credentials for live Llama inference (offline mock ready as fallback).

## Files touched this session

- `apps/web/src/messages/{en,fr,mg}.json`, `apps/web/src/lib/i18n.tsx`
- `apps/web/src/test/i18n-{parity,provider}.test.ts(x)`, `apps/web/src/features/design-system/`, `apps/web/src/app/{layout,design/page}.tsx`
- `apps/web/src/components/layout/{header,sidebar,copilot-panel,app-shell}.tsx`
- `Makefile`, `.github/workflows/ci.yml`, `.claude/rules/web-ui.md`, `CLAUDE.md`, `docs/conventions.md`, `docs/architecture.md`
