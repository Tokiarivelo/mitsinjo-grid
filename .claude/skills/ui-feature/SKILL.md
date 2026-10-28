---
name: ui-feature
description: Build or change a screen, panel or shared component in apps/web following the feature-slice pattern and the design system with dual theming and mobile responsiveness. Use for any UI work outside the 3D scene.
---

Load only: `docs/design/screens/<route>.md` or `docs/design/components.md` (the needed section), plus `docs/design/tokens.md` if styling something new.

0. **Gate in:** run `/design-check` steps 1–4 (spec + mockup). No mockup → note it in stitch-map.
1. Place code: route page → `app/(lab)/<route>/page.tsx` (import only); screen → `features/<feature>/ui/<Name>Page.tsx`; logic → `hooks/useX.ts`; pure helpers → `utils/`; shared → `components/{ui,layout,charts}`.
2. Check `components/ui` first; reuse before creating. Dual theming: use Tailwind `@theme` semantic tokens (`bg-canvas`, `bg-surface`, `bg-surface-elevated`, `border-border`, `text-text-primary`, `text-text-secondary`, `text-solar-amber`, etc.) exclusively so components render cleanly in both Dark (default) and Light theme modes. Zero raw hex or hardcoded colors.
3. Data: hook reads store with narrow selectors; UI receives formatted props. No engine calls in `ui/`.
4. Responsive Mobile: ensure layout reflows gracefully on mobile viewports (320px–768px) with single-column stacking, responsive touch targets ($\ge 44\text{px}$), zero horizontal overflow, and spacing for mobile bottom nav (`pb-20 md:pb-6`). States: empty / error / modified per `docs/design/states-copy.md`. SIMULATED label present.
5. A11y & Contrast: roles, labels, focus-visible, keyboard path, WCAG AA contrast compliance in both dark and light modes.
6. Tests: hook test + interactive component test in `__tests__/`. Verify theme switcher/i18n if touched. Export from feature `index.ts`.
7. `/verify web`, then **gate out:** `/design-check` steps 5–8 (checking desktop 1440×900, mobile 390×844, and dark/light modes).
