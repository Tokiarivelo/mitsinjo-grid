---
paths:
  - 'apps/web/src/features/**'
  - 'apps/web/src/components/**'
  - 'apps/web/src/app/**'
---

# Web UI rules

- **Design gate:** Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding. After: screenshot vs mockup. Never paste Stitch HTML/CSS; rebuild with tokens + `components/ui`.
- `app/**/page.tsx`: import + render the feature page. Nothing else. Layouts may compose shells.
- Feature slice: `ui/` presentational (props in, JSX out), `hooks/` logic, `utils/` pure, `__tests__/`, `index.ts`.
- Server Components by default; `'use client'` only on interactive leaves. Never mark a whole page client.
- Read store with narrow selectors: `useSimulationStore(s => s.status)`; multiple fields → `useShallow`. Never `useSimulationStore()` bare.
- Numbers: only from the store's engine result, formatted via `@/lib/format` with unit. Never compute energy in UI.
- Styling: Tailwind tokens from `@theme` (`bg-surface`, `text-solar-amber`). No raw hex, no inline style colors.
- Status = color + text label (+ icon). Icon-only buttons need `aria-label`.
- **Multi-language (i18n):** All applications and UI surfaces must be multi-lingual using official `next-intl`. Default is English (`en`, for judges), with French (`fr`) and Malagasy (`mg`) toggles. Never hardcode user-visible text in components; extract strings to `apps/web/src/messages/{en,fr,mg}.json` and consume via `useTranslations()`. Provide `LanguageSwitcher` in header and sidebar.
- Every panel/chart has empty, loading (only if real work), and error states — copy in `docs/design/states-copy.md`.
- Show `SIMULATED DATA` on every screen; AI text only inside copilot components with the `AI EXPLANATION` label.
- Spec for a component/screen: load only `docs/design/components.md` or `docs/design/screens/<route>.md`.
