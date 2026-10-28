---
paths:
  - 'apps/web/src/features/**'
  - 'apps/web/src/components/**'
  - 'apps/web/src/app/**'
---

# Web UI rules

- **Design gate:** Run `/design-check` gate-in (spec + Stitch mockup from `docs/design/stitch-map.md`) before coding. After: screenshot vs mockup (desktop 1440×900 and mobile 390×844). Never paste Stitch HTML/CSS; rebuild with tokens + `components/ui`.
- `app/**/page.tsx`: import + render the feature page. Nothing else. Layouts may compose shells.
- Feature slice: `ui/` presentational (props in, JSX out), `hooks/` logic, `utils/` pure, `__tests__/`, `index.ts`.
- Server Components by default; `'use client'` only on interactive leaves. Never mark a whole page client.
- Read store with narrow selectors: `useSimulationStore(s => s.status)`; multiple fields → `useShallow`. Never `useSimulationStore()` bare.
- Numbers: only from the store's engine result, formatted via `@/lib/format` with unit. Never compute energy in UI.
- **Styling & Dual Theming (Dark & Light always):**
  - All UI surfaces must seamlessly support **both Dark (default) and Light theme modes**.
  - **Zero raw hex or hardcoded color literals** in JSX, TSX, SVG or inline CSS. Use Tailwind tokens from `@theme` exclusively (`bg-canvas`, `bg-canvas-raised`, `bg-canvas-sunken`, `bg-surface`, `bg-surface-elevated`, `bg-surface-hover`, `border-border`, `border-border-strong`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `solar-amber`, `energy-cyan`, `battery-green`, `ai-violet`, etc.).
  - Ensure WCAG AA contrast in both themes (and AAA for primary action text via `text-slate-950`).
  - Overlays, tooltips, modals, 3D HTML portal badges, and SVG elements must adapt dynamically to both themes.
  - Theme switching is managed via `useTheme` / `ThemeProvider` with zero hydration flash; provide `ThemeSwitcher` in the top `Header` (icon button) and `Sidebar` drawer (tabs).
- **Responsive Mobile First-Class (Always):**
  - Every screen, card, modal, chart, and panel must be fully responsive from 320px mobile viewports up to 4K displays.
  - **Reflow & Layout:** Multi-column grids must reflow to single column on mobile (`grid-cols-1 md:grid-cols-2 lg:...`). Never set fixed pixel widths that cause horizontal scrolling.
  - **Touch Ergonomics:** Interactive controls (buttons, inputs, sliders, tabs, links) must have touch targets $\ge 44\text{px}$ (or minimum $40\text{px}$).
  - **Navigation:** Primary navigation on small screens (`< md`) uses the docked bottom navigation bar (`MobileNav`) and slide-out `Sidebar` drawer.
  - **Scroll & Viewports:** Main content containers must include bottom padding (`pb-20 md:pb-6`) so floating or docked bottom navigation never obstructs content. Touch scrolling must use smooth momentum (`-webkit-overflow-scrolling: touch`).
  - **Viewports & Canvases:** 3D digital twin viewports and 2D diagrams must use adaptive heights (`min-h-[360px] sm:min-h-[460px] lg:min-h-[640px]`), with compact floating HUD badges and horizontally scrollable controls to prevent viewport clutter on mobile.
- Status = color + text label (+ icon). Icon-only buttons need `aria-label`.
- **Multi-language (i18n) & Zero static text:** All applications and UI surfaces must be multi-lingual using official `next-intl`. Default is English (`en`, for judges), with French (`fr`) and Malagasy (`mg`) toggles. **Zero hardcoded/static user-visible text** in components, pages, or layout code. Every string (labels, titles, subtitles, descriptions, button labels, badges, empty/error copy, and `aria-label`s) must be extracted to `apps/web/src/messages/{en,fr,mg}.json` and consumed via `useTranslations()`. 100% key parity across `en`, `fr`, and `mg` is mandatory and automatically verified in PR validation and CI (`make check-i18n`). Provide `LanguageSwitcher` in header and sidebar.
- Every panel/chart has empty, loading (only if real work), and error states — copy in `docs/design/states-copy.md`.
- Show `SIMULATED DATA` on every screen; AI text only inside copilot components with the `AI EXPLANATION` label.
- Spec for a component/screen: load only `docs/design/components.md` or `docs/design/screens/<route>.md`.
