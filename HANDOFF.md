# HANDOFF — read first, overwrite at end of session (≤40 lines)

**Updated:** 2026-10-28 · **By:** Antigravity (rules/skills update) · **Branch:** `main`

## State

- PR #18 merged into `main` (rules and skills update for dual theming & responsive mobile).
- Light theme (`lib/theme.tsx`, `ThemeSwitcher`) and mobile responsiveness fully operational across all routes.
- Dual theming and responsive mobile first-class rules and skills updated across repo:
  - `CLAUDE.md`, `docs/conventions.md`, `.claude/rules/{web-ui,review,three}.md`
  - `.claude/skills/{review-pr,ui-feature,design-check,scene-3d,designer-3d,design-dispatch}.md`
- Checks green: typecheck, lint, 99 engine tests, 241 web tests, 100% i18n key parity.

## Next task

- Run `make e2e` and `make shots` for dual themes and mobile viewports, then next unchecked task (`make todo`).

## Decisions taken

- Responsive mobile is non-negotiable: single-column reflow, touch targets ≥ 44px, bottom nav (`MobileNav`), `pb-20 md:pb-6`.
- Dual theming is non-negotiable: zero raw hex in JSX/CSS, semantic tokens from `@theme`, WCAG AA contrast.
- 3D/2D overlays and HUD badges use semantic tokens (`bg-surface/90 text-text-primary border-border`) for theme parity.
- Design gate-out requires checking both desktop (1440×900) and mobile (390×844) viewports in both Dark and Light modes.

## Open questions / blockers

- Overview `sheddingProtocolDesc` ("below 20%") + two different site coordinates: static claims, confirm or remove.

## Files touched this session

- Rules: `.claude/rules/{web-ui,review,three}.md`, `CLAUDE.md`, `docs/conventions.md`
- Skills: `.claude/skills/{review-pr,scene-3d,designer-3d,design-dispatch,ui-feature,design-check}/SKILL.md`
- Verification: `make check` (all 340 tests passed across engine and web)
